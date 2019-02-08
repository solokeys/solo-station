function parse_device_response(arr)
{
    var dataview = new DataView(arr.slice(1,5).buffer);

    count = dataview.getUint32(0, true); // get count as 32 bit LE integer

    data = null;
    if (arr[5] == 0) {
        data = arr.slice(6,arr.length);

    }
    return {count: count, status: ctap_error_codes[arr[5]], data: data};
}

function formatBootRequest(cmd, addr, data) {
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

var get_rng = function(func) {
    var req = formatBootRequest(CMD.rng, 0, 0,);
    send_msg_u2f(req, function(resp){
        // if (func) func(resp);
        console.log('RNG RESP:', resp);
    });
}

function wrap_promise(func) {
    var self = this;
    return function() {
        var args = arguments;
        return new Promise(function(resolve, reject) {
           var i;
           var oldfunc = null;
           for (i = 0; i < args.length; i++) {
               if (typeof args[i] == 'function') {
                   oldfunc = args[i];
                   args[i] = function() {
                       oldfunc.apply(self, arguments);
                       resolve.apply(self, arguments);
                   };
                   break;
               }
           }
           if (oldfunc === null) {
               args = Array.prototype.slice.call(args);
               args.push(function() {
                   resolve.apply(self, arguments);
               })
               func.apply(self, args);
           }
        });
    }
}

var get_boot_version_ = function(func) {
    var req = formatBootRequest(CMD.boot_version);
    send_msg_u2f(req, function(resp){
        if (func) func(resp);
        // console.log('BOOT VERSION RESP:', resp);
    });
}

var get_boot_version = wrap_promise.call(get_boot_version_);

var is_bootloader_ = function(func) {

    var req = formatBootRequest(CMD.boot_check);
    send_msg_u2f(req, function(resp){
        if (func) func(resp);
        console.log('IS BOOTLOADER = ', resp.status != 'CTAP1_SUCCESS');
    });
};

var is_bootloader = wrap_promise(is_bootloader_);

var bootloader_write = wrap_promise(function(addr, data, func) {

    var req = formatBootRequest(CMD.boot_write, addr, data);

    console.log("WRITING TO ADDR", addr);

    send_msg_u2f(req, function(resp) {
        if (func) func(resp);
    });
});

var bootloader_reboot_into_app = wrap_promise(function(signature, func) {
    var req = formatBootRequest(CMD.boot_done, 0x8000, signature);
    send_msg_u2f(req, function(resp){
        if (func) func(resp);
        console.log('BOOT DONE RESP:', resp);
    });
});

async function test_is_bootloader() {
    var p = await is_bootloader();
    if (p.status != 'CTAP1_SUCCESS') {
        console.log("NO SUCCESS");
    } else {
        console.log("YES SUCCESS");
    }
    return p.status;
}

async function flash_firmware(file_url) {
    // e.g.: "https://genuine.solokeys.com/hex/example-solo.json"

    var p = await is_bootloader();
    if (p.status != 'CTAP1_SUCCESS')
    {
        console.log("Make sure device is in bootloader mode.  Unplug, hold button, plug in, wait for flashing yellow light.");
        document.getElementById('flashinfo').textContent = 'Make sure device is in bootloader mode.  Unplug, hold button, plug in, wait for flashing yellow light.';
        return;
    }

    let signed_hex = await get_url_json(file_url);

    let reader = new FileReader();
    reader.readAsText(signed_hex);

    content = JSON.parse(file_reader.result);
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
    while(!addr.done) {
        var data = blocks.get(addr.value);
        var i;
        for (i = 0; i < data.length; i += chunk_size) {
            var chunk = data.slice(i,i+chunk_size);
            console.log('ADDR ',addr.value + i);
            p = await bootloader_write(addr.value + i, chunk);

            TEST(p.status == 'CTAP1_SUCCESS', 'Device wrote data');
            var progress = (((i/data.length) * 100 * 100) | 0)/100;
            document.getElementById('flashprogress').textContent = ''+progress+' %';
            //console.log("PROGRESS:", progress);
        }

        addr = addresses.next();
    }
    console.log("...DONE");

    p = await bootloader_reboot_into_app(signature);
    if (p.status != 'CTAP1_SUCCESS') {
        console.log("Firmware image signature denied");
        document.getElementById('flashinfo').textContent = 'Firmware image signature denied';
    }
    else {
        console.log("Update successful");
        document.getElementById('flashinfo').textContent = 'Update successful';
    }

}
