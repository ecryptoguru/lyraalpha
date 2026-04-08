class MicProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0]?.[0];
    if (channel) {
      const copy = new Float32Array(channel.length);
      copy.set(channel);
      this.port.postMessage(copy.buffer, [copy.buffer]);
    }
    return true;
  }
}

registerProcessor("mic-processor", MicProcessor);
