// Serverless WebRTC for cross-device play. No backend: two phones connect by
// exchanging one "invite" code and one "reply" code (copy/paste or QR). One
// ordered DataChannel carries small JSON messages. A public STUN server helps
// NAT traversal; on the same Wi-Fi it usually connects with local candidates.
//
// Signalling is non-trickle: we wait for ICE gathering to finish so each code
// is self-contained.
const STUN = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

function encode(desc) { return btoa(JSON.stringify(desc)); }
function decode(code) { return JSON.parse(atob(code.trim())); }

export class Net {
  constructor() {
    this.pc = null;
    this.ch = null;
    this.onMessage = () => {};
    this.onOpen = () => {};
    this.onClose = () => {};
    this.connected = false;
  }

  _wire(channel) {
    this.ch = channel;
    channel.onopen = () => { this.connected = true; this.onOpen(); };
    channel.onclose = () => { this.connected = false; this.onClose(); };
    channel.onmessage = (e) => { try { this.onMessage(JSON.parse(e.data)); } catch (_) {} };
  }

  _gathered() {
    return new Promise((resolve) => {
      if (this.pc.iceGatheringState === "complete") return resolve();
      const check = () => {
        if (this.pc.iceGatheringState === "complete") {
          this.pc.removeEventListener("icegatheringstatechange", check);
          resolve();
        }
      };
      this.pc.addEventListener("icegatheringstatechange", check);
      setTimeout(resolve, 2500); // fall back if gathering stalls
    });
  }

  /** HOST: create the invite code. */
  async host() {
    this.pc = new RTCPeerConnection(STUN);
    this.pc.onconnectionstatechange = () => {
      if (["disconnected", "failed", "closed"].includes(this.pc.connectionState)) this.onClose();
    };
    this._wire(this.pc.createDataChannel("zook", { ordered: true }));
    await this.pc.setLocalDescription(await this.pc.createOffer());
    await this._gathered();
    return encode(this.pc.localDescription);
  }

  /** HOST: finish once the guest's reply code is pasted in. */
  async hostAccept(replyCode) {
    await this.pc.setRemoteDescription(decode(replyCode));
  }

  /** GUEST: consume the invite code, return the reply code. */
  async join(inviteCode) {
    this.pc = new RTCPeerConnection(STUN);
    this.pc.onconnectionstatechange = () => {
      if (["disconnected", "failed", "closed"].includes(this.pc.connectionState)) this.onClose();
    };
    this.pc.ondatachannel = (e) => this._wire(e.channel);
    await this.pc.setRemoteDescription(decode(inviteCode));
    await this.pc.setLocalDescription(await this.pc.createAnswer());
    await this._gathered();
    return encode(this.pc.localDescription);
  }

  send(obj) { if (this.ch && this.ch.readyState === "open") this.ch.send(JSON.stringify(obj)); }

  close() {
    try { this.ch && this.ch.close(); } catch (_) {}
    try { this.pc && this.pc.close(); } catch (_) {}
    this.connected = false;
  }
}
