function parse_device_response(arr)
{
    // https://fidoalliance.org/specs/fido-u2f-v1.2-ps-20170411/fido-u2f-raw-message-formats-v1.2-ps-20170411.html#authentication-response-message-success
    //
    // first byte: always 1 :))
    // bytes 1-4: big-endian counter
    // X bytes: signature over various things
    var dataview = new DataView(arr.slice(1,5).buffer);

    count = dataview.getUint32(0, false); // get count as 32 bit BE integer

    data = null;
    if (arr[5] == 0) {
        data = arr.slice(6,arr.length);

    }
    return {count: count, status: ctap_error_codes[arr[5]], data: data};
}

function encode_ctap1_request_as_keyhandle(cmd, addr, data) {
    console.log('REQUEST CMD', cmd);
    console.log('REQUEST ADDR', addr);
    console.log('REQUEST DATA', data);

    // for some reason, doesn't work with this
    //data = data || new Uint8Array(1);
    // this needs ES6
    data = data || new Uint8Array(16).fill(65);

    const offset = 10;

    if (offset + data.length > 255) {
        throw new Error("Max size exceeded");
    }

    var array = new Uint8Array(offset + data.length);

    array[0] = cmd & 0xff;

    array[1] = (addr >> 0) & 0xff;
    array[2] = (addr >> 8) & 0xff;
    array[3] = (addr >> 16) & 0xff;

    // magic values, telling bootloader U2F interface
    // to interpret `data` as encoded U2F APDU command,
    // when passed as keyhandle in u2f.sign.
    // yes, there can theoretically be clashes :)
    array[4] = 0x8C;
    array[5] = 0x27;
    array[6] = 0x90;
    array[7] = 0xf6;

    array[8] = 0;
    array[9] = data.length & 0xff;

    array.set(data, offset);

    console.log('FORMATTED REQUEST:', array);
    return array;
}

function send_msg_u2f(data, func, timeout) {
    // Use key handle and signature response as comm channel
    var d = new Date();
    var t1 = d.getTime();
    timeout = timeout || 5;  // 1 second is not enough

    // ehhh... this is one place where FIDO2 has better handling than U2F
    var appid = window.location.origin;
    var chal = array2websafe(hex2array('d1cd7357bcedc03fcec112fe5a7f3f890292ff6f758978928b736ce1e63479e5'));

    var keyHandle = array2websafe(data);

    var key = {
        version: 'U2F_V2',
        keyHandle: keyHandle,
        transports: [],
        appId: appid
    };

    window.u2f.sign(appid, chal, [key], function(res) {
        /*
        if (res.errorCode) {
            console.log('RES.ERRORCODE', res.errorCode);
        } else {
            */

            //console.log('window.u2f.sign RESPONSE:', res)
            var d2 = new Date();
            t2 = d2.getTime();
            // console.log('TOOK:', t2 - t1);
            if (!res.signatureData)
                func(res);

            var sig = websafe2array(res.signatureData);
            data = parse_device_response(sig);
            func(data);
        //}},
        },
        timeout
    );
}


