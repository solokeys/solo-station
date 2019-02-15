async function prepare_genuine() {
    document.getElementById('success').textContent = '';
    document.getElementById('success-version').textContent = '';
    document.getElementById('errors').textContent = '';
    document.getElementById('debug').textContent = '';
    document.getElementById('useragent').textContent = platform.description;
    // Misleading: It's (probably) not the browser that does not support U2F.
    // But: without including u2f-api.js, Chrome has no easy window.u2f.sign interface
    // Similarly, without the about:config dance, Firefox does not have it either
    // We want to stay future-proof, and use the WebAuthn credentials interface throughout
    // if (window.u2f && window.u2f.sign) {
    //     document.getElementById('success').textContent += 'Your browser supports U2F. ';
    // } else {
    //     document.getElementById('errors').textContent += 'Your browser does not support U2F. ';
    // }
    if (!window.PublicKeyCredential) {
        document.getElementById('errors').textContent += 'Your browser does not support WebAuthn';
    } else {
        document.getElementById('success').textContent += 'Your browser supports WebAuthn';
    }

	await check_version();
}

async function check_version(){
    document.getElementById('errors').textContent = 'Checking firmware version, please wait...';
    document.getElementById('success-version').textContent = '';

	await ctaphid_vendor_over_webauthn(CMD.solo_version)
	.then(response => {
		console.log("IN THEN BRANCH FOR", CMD.solo_version);
		console.log("RESPONSE:", response);
		let version_and_noise = response.data;
		let formatted_version = version_and_noise[0] + '.' + version_and_noise[1] + '.' + version_and_noise[2];
		console.log(formatted_version);
		document.getElementById('errors').textContent = '';
		document.getElementById('success-version').textContent = 'Firmware is up to date: ' + formatted_version;
	}
	)
	.catch((error) => {
		console.log("IN CATCH BRANCH FOR", CMD.solo_version);
		console.log("CAUGHT:", error);
		document.getElementById('errors').textContent = 'Your firmware is out of date.  Please update.';
	});
}

async function create_direct_attestion() {
    // random nonce
    var challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    // our relying party
    let rp_id = window.location.hostname;

    // GOAL: register a key signed by key's attestation certificate
    let publicKeyCredentialCreationOptions = {
		rp: {
			name: 'SoloKeys Station',
			id: rp_id,
		},

		attestation: 'direct',

		challenge,

		pubKeyCredParams: [
			{ type: 'public-key', alg: -7 },
		],

		user: {
			id: new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]),
			name: 'jsmith@example.com',
			displayName: 'Joe Smith',
		},

		timeout: 30000,
		excludeCredentials: [],
	};

	return navigator.credentials.create({
		publicKey: publicKeyCredentialCreationOptions
	});
};

async function check() {
    await prepare_genuine();

    create_direct_attestion().then(response => {
        console.log('CREDENTIAL:', response);
        document.getElementById('success').textContent = 'Got a response';
        console.log('PRE-DE-CBOR',response.response.attestationObject);

        const utf8Decoder = new TextDecoder('utf-8');
        const decodedClientData = utf8Decoder.decode(
            response.response.clientDataJSON)
        const clientDataObj = JSON.parse(decodedClientData);
        console.log('CLIENTDATA', clientDataObj)

        var attestation = CBOR.decode(response.response.attestationObject);
        console.log('ATTESTATION', attestation);
        var x5c = attestation.attStmt.x5c[0];
        // console.log('X5C', x5c.join(', '));
        console.log('X5C', x5c);
		let fp = sha256(x5c);
		console.log('FINGERPRINT', fp);

		let what_is_it = known_certs_lookup[fp];

		if (typeof what_is_it === "undefined") {
            console.log("UNKNOWN ATTESTATION KEY");
            document.getElementById('errors').textContent = 'Unknown key';
		} else {
            console.log(what_is_it);
            document.getElementById('success').textContent += `: ${what_is_it}`;
		};

        // check_version();

    })
    .catch(e => {
        console.log(e);
        document.getElementById('debug').textContent = e.message;
    });
}
