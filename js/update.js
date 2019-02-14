var get_rng_ = function(func) {
    var req = encode_ctap1_request_as_keyhandle(CMD.rng, 0, 0,);
    send_msg_u2f(req, function(resp){
        // if (func) func(resp);
        console.log('RNG RESP:', resp);
    });
}

var get_rng = wrap_promise(get_rng_);

var get_version = wrap_promise(function(func) {
    var req = encode_ctap1_request_as_keyhandle(CMD.version);
    send_msg_u2f(req, function(resp){
        if (func) func(resp);
        console.log('VERSION RESP:', resp);
    });
})

var get_boot_version_ = function(func) {
    var req = encode_ctap1_request_as_keyhandle(CMD.boot_version);
    send_msg_u2f(req, function(resp){
        if (func) func(resp);
        // console.log('BOOT VERSION RESP:', resp);
    });
}

var get_boot_version = wrap_promise.call(get_boot_version_);

var is_bootloader_ = function(func) {

    var req = encode_ctap1_request_as_keyhandle(CMD.boot_check);
    send_msg_u2f(req, function(resp){
        if (func) func(resp);
        console.log('IS BOOTLOADER = ', resp.status != 'CTAP1_SUCCESS');
    });
};

var is_bootloader = wrap_promise(is_bootloader_);

var bootloader_write = wrap_promise(function(addr, data, func) {

    var req = encode_ctap1_request_as_keyhandle(CMD.boot_write, addr, data);

    console.log("WRITING TO ADDR", addr);

    send_msg_u2f(req, function(resp) {
        if (func) func(resp);
    });
});

var bootloader_reboot_into_app = wrap_promise(function(signature, func) {
    var req = encode_ctap1_request_as_keyhandle(CMD.boot_done, 0x8000, signature);
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

