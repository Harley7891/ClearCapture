const fs=require('node:fs');const path=require('node:path');const zlib=require('node:zlib');
const size=256;const rgba=Buffer.alloc(size*(size*4+1));
for(let y=0;y<size;y++){const row=y*(size*4+1);for(let x=0;x<size;x++){const qx=Math.max(30-x,x-225,0),qy=Math.max(30-y,y-225,0);const inside=Math.hypot(qx,qy)<30;const i=row+1+x*4;rgba[i]=Math.round(164-y*.19);rgba[i+1]=Math.round(128-y*.21);rgba[i+2]=242;rgba[i+3]=inside?255:0;const body=x>=54&&x<=157&&y>=76&&y<=181;const lens=x>=163&&x<=208&&Math.abs(y-128)<=((x-163)*.6+16);const hole=x>=74&&x<=137&&y>=96&&y<=161;if((body&&!hole)||lens){rgba[i]=255;rgba[i+1]=255;rgba[i+2]=255;}}}
function crc(data){let c=0xffffffff;for(const byte of data){c^=byte;for(let j=0;j<8;j++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;}
function chunk(type,data){const b=Buffer.alloc(12+data.length);b.writeUInt32BE(data.length,0);b.write(type,4);data.copy(b,8);b.writeUInt32BE(crc(b.subarray(4,8+data.length)),8+data.length);return b;}
const header=Buffer.alloc(13);header.writeUInt32BE(size,0);header.writeUInt32BE(size,4);header[8]=8;header[9]=6;
const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',zlib.deflateSync(rgba)),chunk('IEND',Buffer.alloc(0))]);
const ico=Buffer.alloc(22);ico.writeUInt16LE(1,2);ico.writeUInt16LE(1,4);ico.writeUInt16LE(32,12);ico.writeUInt32LE(png.length,14);ico.writeUInt32LE(22,18);
fs.writeFileSync(path.join(__dirname,'..','assets','icon.png'),png);fs.writeFileSync(path.join(__dirname,'..','assets','icon.ico'),Buffer.concat([ico,png]));
