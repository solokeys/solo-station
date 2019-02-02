function prepare() {
    document.getElementById('success').textContent = '';
    document.getElementById('errors').textContent = '';
    document.getElementById('useragent').textContent = platform.description;
    if (!window.PublicKeyCredential) {
        document.getElementById('errors').textContent = 'Your browser does not support WebAuthn';
        return;
    }
    document.getElementById('success').textContent = 'Your browser supports WebAuthn';

}

function check() {
    // random nonce
    var challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);
    console.log('CHALLENGE', challenge);

    // known attestation certificates
    known = {
        "solo_secure": "8e06b4060fc58677055285ce3ee6a69a0666b59f4c2a0a00a025c7f0f3ce9a50",
        "solo_hacker": "2a0a22ceaedac89b3d02e2b53cbfaa763c6efa8a73f03976ec72fe4c5d9a1ff3",
        "u2f_zero": "ded15e86dae60b48f7507bc81d7471b61102c2eb844bd954b653164d8c0cb677",
    }

    // our relying party
    let rp_id = window.location.hostname;
    console.log('RELYING PARTY ID', rp_id);

    // GOAL: register a key signed by key's attestation certificate
    var makePublicKey = {
    rp: {
        name: 'SoloKeys Station',
        id: rp_id,
    },

    attestation: 'direct',

    user: {
        id: new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]),
        name: 'jsmith@example.com',
        displayName: 'Joe Smith',
    },

    challenge,

    pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
    ],

    timeout: 30000,
        excludeCredentials: [],
    };

    let credPromise = navigator.credentials.create(
        {publicKey: makePublicKey}
    ).then(response => {
        document.getElementById('success').textContent = 'Got a response';
        console.log('PRE-DE-CBOR',response.response.attestationObject);
        var attestation = CBOR.decode(response.response.attestationObject);
        console.log('ATTESTATION', attestation);
        var x5c = attestation.attStmt.x5c[0];
        // console.log('X5C', x5c.join(', '));
        console.log('X5C', x5c);
		let fp = sha256(x5c);
		console.log('FP', fp);

        if (fp === known["solo_secure"]) {
            console.log("THIS IS A SOLO SECURE");
            document.getElementById('success').textContent += ': valid Solo Secure';
        } else if (fp === known["solo_hacker"]) {
            console.log("THIS IS PROBABLY A SOLO HACKER");
            document.getElementById('success').textContent += ': key attests as Solo Hacker';
        } else if (fp === known["u2f_zero"]) {
            console.log("THIS IS PROBABLY A U2F ZERO");
            document.getElementById('success').textContent += ': key attests as U2F Zero';
        } else {
            console.log("UNKNOWN ATTESTATION");
            document.getElementById('errors').textContent = 'unknown key';
        }
    })
    .catch(e => {
        console.log(e);
        document.getElementById('debug').textContent = e.message;
    });
}
