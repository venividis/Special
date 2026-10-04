/*───────────────────────────────────────────────────────────────────────────
  whispers.mjs — browser-native sealing for Parley's pair rooms

  Origin: Pixel-Garden sdk/whispers.mjs, verbatim (INTACT U4). The only
  edits are the two domain labels (the "pixel-" prefix of the whisper and
  key-backup contexts became "intact-"), so an envelope sealed for one
  protocol can never be opened as the other's.

  The scheme (DESIGN.md §7.3): an ephemeral P-256 ECDH agreement per
  message → HKDF-SHA-256 → AES-256-GCM, with the associated data binding
  the chain, the Parley address, both token ids, both custody epochs and
  both key versions, so an envelope replayed against any other context
  fails to open. Two copies are sealed — one to the recipient's key, one to
  the sender's — so both sides can read their own archive. There is no
  forward secrecy: a holder who derives the same P-256 scalar from the same
  signature reads the same envelopes, which is the point of deriving it
  (IPSEITY `announce`: "the reason a client derives the key from a
  signature rather than generating one it has to keep"). The scalar's
  derivation from `personal_sign("INTACT seal v1 · chain <c> · token <t> ·
  epoch <e>")` and the re-read of the recipient's key immediately before
  every encryption (IPSEITY B1, PR #27) live in the social panel (U9),
  which imports this module.

  `whisperScope(chain, hub, parley, token, epoch)` is the context tuple;
  `messageContext(scope, to, toEpoch, toVersion, fromVersion)` the AAD. An
  envelope over 4,096 bytes is refused here before Parley refuses it.
───────────────────────────────────────────────────────────────────────────*/
// Browser-native encryption. Private keys never enter an application frame, RPC or contract.
const enc = new TextEncoder(),
  dec = new TextDecoder("utf-8", { fatal: true });
const bytes = (s) => enc.encode(s);
const text = (b) => dec.decode(b);
const b64 = (b) => btoa(String.fromCharCode(...new Uint8Array(b)));
const un64 = (s) => {
  if (typeof s !== "string" || s.length > 200000 || !/^[A-Za-z0-9+/]*={0,2}$/.test(s))
    throw Error("Invalid encoded bytes");
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
};
const random = (n) => crypto.getRandomValues(new Uint8Array(n));
const subtle = () => crypto.subtle;
export const whisperScope = (chain, kernel, social, garden, epoch) => [
  String(chain),
  kernel.toLowerCase(),
  social.toLowerCase(),
  String(garden),
  String(epoch),
];
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export const publicHex = (key) =>
  "0x" + Array.from(un64(key.publicKey), (b) => b.toString(16).padStart(2, "0")).join("");
export const hexPublic = (hex) =>
  b64(Uint8Array.from(hex.slice(2).match(/../g) || [], (n) => parseInt(n, 16)));
export async function createMessagingKey(version) {
  const pair = await subtle().generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveBits",
  ]);
  return {
    version: String(version),
    publicKey: b64(await subtle().exportKey("raw", pair.publicKey)),
    privateKey: await subtle().exportKey("jwk", pair.privateKey),
  };
}
async function pub(s) {
  return subtle().importKey("raw", un64(s), { name: "ECDH", namedCurve: "P-256" }, false, []);
}
async function priv(k) {
  return subtle().importKey("jwk", k.privateKey, { name: "ECDH", namedCurve: "P-256" }, false, [
    "deriveBits",
  ]);
}
async function shared(privateKey, publicKey, salt, context) {
  const bits = await subtle().deriveBits({ name: "ECDH", public: publicKey }, privateKey, 256);
  const source = await subtle().importKey("raw", bits, "HKDF", false, ["deriveKey"]);
  return subtle().deriveKey(
    { name: "HKDF", hash: "SHA-256", salt, info: bytes(context) },
    source,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}
// Fixed-order associated data binds both custody epochs, exact contract and recipient key versions.
export function messageContext(scope, to, toEpoch, toVersion, fromVersion) {
  return [
    "intact-whisper/1",
    ...scope,
    String(to),
    String(toEpoch),
    String(toVersion),
    String(fromVersion),
  ];
}
export async function encryptWhisper(context, plaintext, toPublicKey, fromPublicKey) {
  const clear = bytes(plaintext);
  if (!clear.length || clear.length > 1024) throw Error("Whispers support 1–1024 UTF-8 bytes");
  const ephemeral = await subtle().generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveBits",
  ]);
  const ephemeralPublic = b64(await subtle().exportKey("raw", ephemeral.publicKey)),
    salt = random(32);
  const copies = [];
  for (const [role, publicKey] of [
    ["recipient", toPublicKey],
    ["sender", fromPublicKey],
  ]) {
    const aad = JSON.stringify([...context, role]);
    const key = await shared(ephemeral.privateKey, await pub(publicKey), salt, aad),
      iv = random(12);
    copies.push({
      iv: b64(iv),
      ciphertext: b64(
        await subtle().encrypt({ name: "AES-GCM", iv, additionalData: bytes(aad) }, key, clear),
      ),
    });
  }
  const envelope = { v: 1, context, ephemeralPublic, salt: b64(salt), copies };
  if (bytes(JSON.stringify(envelope)).length > 4096)
    throw Error("Encrypted envelope exceeds onchain limit");
  return envelope;
}
export async function decryptWhisper(envelope, expectedContext, key, role = "recipient") {
  if (
    envelope.v !== 1 ||
    !equal(envelope.context, expectedContext) ||
    !["recipient", "sender"].includes(role) ||
    envelope.copies?.length !== 2
  )
    throw Error("Whisper identity mismatch");
  const salt = un64(envelope.salt);
  if (salt.length !== 32) throw Error("Invalid encryption salt");
  const copy = envelope.copies[role === "recipient" ? 0 : 1],
    iv = un64(copy.iv),
    cipher = un64(copy.ciphertext);
  if (iv.length !== 12 || cipher.length < 17 || cipher.length > 1040)
    throw Error("Invalid encrypted message");
  const aad = JSON.stringify([...expectedContext, role]);
  const secret = await shared(await priv(key), await pub(envelope.ephemeralPublic), salt, aad);
  return text(
    await subtle().decrypt({ name: "AES-GCM", iv, additionalData: bytes(aad) }, secret, cipher),
  );
}
async function passwordKey(password, salt) {
  if (typeof password !== "string" || password.length < 12 || password.length > 1024)
    throw Error("Use a backup passphrase of 12–1024 characters");
  const source = await subtle().importKey("raw", bytes(password), "PBKDF2", false, ["deriveKey"]);
  return subtle().deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: 310000 },
    source,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}
export async function encryptKeyBackup(scope, keys, password) {
  if (!keys.length || keys.length > 128) throw Error("Backup key count must be 1–128");
  const salt = random(32),
    iv = random(12),
    context = ["intact-key-backup/1", ...scope];
  const key = await passwordKey(password, salt);
  return {
    v: 1,
    scope,
    salt: b64(salt),
    iv: b64(iv),
    ciphertext: b64(
      await subtle().encrypt(
        { name: "AES-GCM", iv, additionalData: bytes(JSON.stringify(context)) },
        key,
        bytes(JSON.stringify(keys)),
      ),
    ),
  };
}
export async function decryptKeyBackup(backup, scope, password) {
  if (
    backup.v !== 1 ||
    !equal(backup.scope, scope) ||
    un64(backup.salt).length !== 32 ||
    un64(backup.iv).length !== 12
  )
    throw Error("Backup belongs to another Garden, owner epoch or runtime");
  const key = await passwordKey(password, un64(backup.salt));
  const raw = await subtle().decrypt(
    {
      name: "AES-GCM",
      iv: un64(backup.iv),
      additionalData: bytes(JSON.stringify(["intact-key-backup/1", ...scope])),
    },
    key,
    un64(backup.ciphertext),
  );
  const keys = JSON.parse(text(raw));
  if (
    !Array.isArray(keys) ||
    !keys.length ||
    keys.length > 128 ||
    new Set(keys.map((k) => k.version)).size !== keys.length
  )
    throw Error("Invalid key backup");
  for (const k of keys) {
    if (!/^[1-9][0-9]*$/.test(k.version) || k.version.length > 78)
      throw Error("Invalid key version");
    // Verify private/public pairing before importing a recovered key into the workspace.
    const probe = await subtle().generateKey({ name: "ECDH", namedCurve: "P-256" }, false, [
      "deriveBits",
    ]);
    const a = await subtle().deriveBits(
      { name: "ECDH", public: await pub(k.publicKey) },
      probe.privateKey,
      256,
    );
    const b = await subtle().deriveBits(
      { name: "ECDH", public: probe.publicKey },
      await priv(k),
      256,
    );
    if (b64(a) !== b64(b)) throw Error("Backup key pair mismatch");
  }
  return keys;
}
