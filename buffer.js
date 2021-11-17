class Buffer {
constructor (length) {
this.length =length;
this.data = new Float32Array(length);
this.index = 0;
this.value = 0.0;
} // constructor

write (sample) {
this.data[this.index] = sample;
this.index += 1;
if (this.index >= this.length) this.index = 0;
//console.debug("- index = ", this.index);
} // write

read (delay) {
if (delay >= 0 && delay < this.length) {
        let index = this.index - delay;
if (index < 0) index += this.length;
        this.value = this.data[Math.floor(index)];
    } // if

return this.value;
} // read

readByTime (delay) {return this.read(delay * sampleRate);}
} // class Buffer

