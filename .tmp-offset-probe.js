const fs = require('fs');
const zlib = require('zlib');
const raw = fs.readFileSync('src/assets/backup/players.dat');
const data = zlib.inflateSync(raw);
const stride = 112;
const total = Math.floor((data.length - 122) / stride) + 1;
const offsets = [0x6A,0x6B,0x6C,0x6D,0x6E,0x6F];
for (const off of offsets) {
  const counts = new Map();
  for (let i=0;i<total;i++) {
    const value = data[i*stride + off];
    counts.set(value, (counts.get(value)||0)+1);
  }
  const top = [...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10);
  console.log('offset', '0x'+off.toString(16), 'unique', counts.size, 'top', JSON.stringify(top));
}
