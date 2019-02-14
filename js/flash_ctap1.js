function parse_ctaphid_vendor_over_webauthn_response(response)
{
    // https://fidoalliance.org/specs/fido-v2.0-rd-20170927/fido-client-to-authenticator-protocol-v2.0-rd-20170927.html#using-the-ctap2-authenticatorgetassertion-command-with-ctap1-u2f-authenticators<Paste>
	//
	// compared to `parse_device_response`, the data is encoded a little differently here
	//
	// attestation.response.authenticatorData
	//
	// first 32 bytes: SHA-256 hash of the rp.id
	// 1 byte: zeroth bit = user presence set in U2F response (always 1)
	// last 4 bytes: signature counter (32 bit big-endian)
	//
	// attestation.response.signature
	// signature data (bytes 5-end of U2F response

	signature_count = (
		new DataView(
			response.authenticatorData.slice(33, 37)
		)
	).getUint32(0, false); // get count as 32 bit BE integer

	signature = new Uint8Array(response.signature);
    data = null;
	error_code = signature[0];
    if (error_code == 0) {
        data = signature.slice(1, signature.length);

    }
    return {
		count: signature_count,
		status: ctap_error_codes[error_code],
		data: data,
		signature: signature,
    };
}

async function ctaphid_vendor_over_webauthn(cmd, addr, data) {
    // if a token does not support CTAP2, WebAuthn re-encodes as CTAP1/U2F:
    // https://fidoalliance.org/specs/fido-v2.0-rd-20170927/fido-client-to-authenticator-protocol-v2.0-rd-20170927.html#interoperating-with-ctap1-u2f-authenticators
    //
    // the bootloader only supports CTAP1, so the idea is to drop
    // u2f-api.js and the Firefox about:config fiddling
    //
    // problem: the popup to press button flashes up briefly :(
    //

    var u2f_cmd_as_keyhandle = encode_ctap1_request_as_keyhandle(cmd, addr, data);
    var challenge = window.crypto.getRandomValues(new Uint8Array(32));

    var request_options = {
        challenge: challenge,
        allowCredentials: [{
            id: u2f_cmd_as_keyhandle,
            type: 'public-key',
        }],
        userVerification: "discouraged",
        timeout: 5000,
    }

    var assertion = await navigator.credentials.get({publicKey: request_options});
    return parse_ctaphid_vendor_over_webauthn_response(assertion.response);

}

async function prepare_flash() {
    // for (i = 0; i < 10; i++) {
    //     await ctaphid_vendor_over_webauthn(CMD.boot_check);
    // }

    document.getElementById('flasherror').textContent = '';
    var p = await is_bootloader();
    if (p.status != 'CTAP1_SUCCESS')
    {
        console.log("Make sure device is in bootloader mode.  Unplug, hold button, plug in, wait for flashing yellow light.");
        document.getElementById('flasherror').textContent = 'Make sure device is in bootloader mode.  Unplug, hold button, plug in, wait for flashing yellow light.';
        return;
    }
}

async function flash_firmware(file_url) {
    // e.g.: "https://genuine.solokeys.com/hex/example-solo.json"

    // await prepare_flash();

    let signed_hex = await get_url_json(file_url);
    console.log("SIGNED HEX", signed_hex);

    const readFetchedFileAsText = (inputFile) => {
      const temporaryFileReader = new FileReader();

      return new Promise((resolve, reject) => {
        temporaryFileReader.onerror = () => {
          temporaryFileReader.abort();
          reject(new DOMException("Problem parsing input file."));
        };

        temporaryFileReader.onload = () => {
          resolve(temporaryFileReader.result);
        };
        temporaryFileReader.readAsText(inputFile);
      });
    };

    var fileContents = await readFetchedFileAsText(signed_hex);
    // let file_reader = new FileReader();
    // await wrap_promise(file_reader.readAsText(signed_hex);

    // console.log("FILE READER", file_reader);
    // console.log("FILE READER.RESULT", file_reader.result);
    console.log("FILE CONTENTS:", fileContents);

    // content = JSON.parse(file_reader.result);
    content = JSON.parse(fileContents);
    console.log("CONTENT", content);
    let firmware = websafe2string(content.firmware);
    var signature = websafe2array(content.signature);
    // make it a bad signature
    // outcome: existing firmware gets overwritten, but Solo stays in bootloader
    // fix: flash a properly signed firmware :D
    // signature[40] = signature[40] ^ 1;

    let num_pages = 64;

    console.log("FIRMWARE", firmware);
    let blocks = MemoryMap.fromHex(firmware);
    let addresses = blocks.keys();

    console.log("BLOCKS:", blocks);
    console.log("ADDRESSES:", addresses);

    let addr = addresses.next();
    let chunk_size = 240;
    console.log("WRITING...");

    var use_webauthn = true;

    while(!addr.done) {
        var data = blocks.get(addr.value);
        var i;
        for (i = 0; i < data.length; i += chunk_size) {
            var chunk = data.slice(i,i+chunk_size);
            console.log('ADDR ',addr.value + i);
            if (use_webauthn) {
                console.log("ATTEMPTING U2F OVER WEBAUTHN");
                p = await ctaphid_vendor_over_webauthn(
                    CMD.boot_write,
                    addr.value + i,
                    chunk
                );
                // console.log("CMD.boot_write response:", p);
				// typical response: {count: 10, status: "CTAP1_SUCCESS", data: Uint8Array(0)}
                TEST(p.status == 'CTAP1_SUCCESS', 'Device wrote data');
            } else {
                p = await bootloader_write(addr.value + i, chunk);
                TEST(p.status == 'CTAP1_SUCCESS', 'Device wrote data');
            }

            var progress = (((i/data.length) * 100 * 100) | 0)/100;
            document.getElementById('flashprogress').textContent = ''+progress+'%';
            //console.log("PROGRESS:", progress);
        }

        addr = addresses.next();
    }
    document.getElementById('flashprogress').textContent = '100%';
    console.log("...DONE");

    if (use_webauthn) {
        p = await ctaphid_vendor_over_webauthn(
                CMD.boot_done, 0x8000, signature
        );
    } else {
        p = await bootloader_reboot_into_app(signature);
        if (p.status != 'CTAP1_SUCCESS') {
            console.log("Firmware image signature denied");
            document.getElementById('flasherror').textContent = 'Firmware image signature denied';
        }
        else {
            console.log("Update successful");
            document.getElementById('flashsuccess').textContent = 'Update successful';
        }
    }

}
