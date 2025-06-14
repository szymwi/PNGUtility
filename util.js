/**
 * 
 * 
 * 
 * UPNG
 */
const __UPNG__ = (function() {
	
	var _bin = {
		nextZero   : function(data,p)  {  while(data[p]!=0) p++;  return p;  },
		readUshort : function(buff,p)  {  return (buff[p]<< 8) | buff[p+1];  },
		writeUshort: function(buff,p,n){  buff[p] = (n>>8)&255;  buff[p+1] = n&255;  },
		readUint   : function(buff,p)  {  return (buff[p]*(256*256*256)) + ((buff[p+1]<<16) | (buff[p+2]<< 8) | buff[p+3]);  },
		writeUint  : function(buff,p,n){  buff[p]=(n>>24)&255;  buff[p+1]=(n>>16)&255;  buff[p+2]=(n>>8)&255;  buff[p+3]=n&255;  },
		readASCII  : function(buff,p,l){  var s = "";  for(var i=0; i<l; i++) s += String.fromCharCode(buff[p+i]);  return s;    },
		writeASCII : function(data,p,s){  for(var i=0; i<s.length; i++) data[p+i] = s.charCodeAt(i);  },
		readBytes  : function(buff,p,l){  var arr = [];   for(var i=0; i<l; i++) arr.push(buff[p+i]);   return arr;  },
		pad : function(n) { return n.length < 2 ? "0" + n : n; },
		readUTF8 : function(buff, p, l) {
			var s = "", ns;
			for(var i=0; i<l; i++) s += "%" + _bin.pad(buff[p+i].toString(16));
			try {  ns = decodeURIComponent(s); }
			catch(e) {  return _bin.readASCII(buff, p, l);  }
			return  ns;
		}
	}

	function toRGBA8(out)
	{
		var w = out.width, h = out.height;
		if(out.tabs.acTL==null) return [decodeImage(out.data, w, h, out).buffer];
		
		var frms = [];
		if(out.frames[0].data==null) out.frames[0].data = out.data;
		
		var len = w*h*4, img = new Uint8Array(len), empty = new Uint8Array(len), prev=new Uint8Array(len);
		for(var i=0; i<out.frames.length; i++)
		{
			var frm = out.frames[i];
			var fx=frm.rect.x, fy=frm.rect.y, fw = frm.rect.width, fh = frm.rect.height;
			var fdata = decodeImage(frm.data, fw,fh, out);
			
			if(i!=0) for(var j=0; j<len; j++) prev[j]=img[j];
			
			if     (frm.blend==0) _copyTile(fdata, fw, fh, img, w, h, fx, fy, 0);
			else if(frm.blend==1) _copyTile(fdata, fw, fh, img, w, h, fx, fy, 1);
			
			frms.push(img.buffer.slice(0));
			
			if     (frm.dispose==0) {}
			else if(frm.dispose==1) _copyTile(empty, fw, fh, img, w, h, fx, fy, 0);
			else if(frm.dispose==2) for(var j=0; j<len; j++) img[j]=prev[j];
		}
		return frms;
	}
	function decodeImage(data, w, h, out)
	{
		var area = w*h, bpp = _getBPP(out);
		var bpl = Math.ceil(w*bpp/8);	// bytes per line

		var bf = new Uint8Array(area*4), bf32 = new Uint32Array(bf.buffer);
		var ctype = out.ctype, depth = out.depth;
		var rs = _bin.readUshort;
		
		//console.log(ctype, depth);
		var time = Date.now();

		if     (ctype==6) { // RGB + alpha
			var qarea = area<<2;
			if(depth== 8) for(var i=0; i<qarea;i+=4) {  bf[i] = data[i];  bf[i+1] = data[i+1];  bf[i+2] = data[i+2];  bf[i+3] = data[i+3]; }
			if(depth==16) for(var i=0; i<qarea;i++ ) {  bf[i] = data[i<<1];  }
		}
		else if(ctype==2) {	// RGB
			var ts=out.tabs["tRNS"];
			if(ts==null) {
				if(depth== 8) for(var i=0; i<area; i++) {  var ti=i*3;  bf32[i] = (255<<24)|(data[ti+2]<<16)|(data[ti+1]<<8)|data[ti];  }
				if(depth==16) for(var i=0; i<area; i++) {  var ti=i*6;  bf32[i] = (255<<24)|(data[ti+4]<<16)|(data[ti+2]<<8)|data[ti];  }
			}
			else {  var tr=ts[0], tg=ts[1], tb=ts[2];
				if(depth== 8) for(var i=0; i<area; i++) {  var qi=i<<2, ti=i*3;  bf32[i] = (255<<24)|(data[ti+2]<<16)|(data[ti+1]<<8)|data[ti];
					if(data[ti]   ==tr && data[ti+1]   ==tg && data[ti+2]   ==tb) bf[qi+3] = 0;  }
				if(depth==16) for(var i=0; i<area; i++) {  var qi=i<<2, ti=i*6;  bf32[i] = (255<<24)|(data[ti+4]<<16)|(data[ti+2]<<8)|data[ti];
					if(rs(data,ti)==tr && rs(data,ti+2)==tg && rs(data,ti+4)==tb) bf[qi+3] = 0;  }
			}
		}
		else if(ctype==3) {	// palette
			var p=out.tabs["PLTE"], ap=out.tabs["tRNS"], tl=ap?ap.length:0;
			//console.log(p, ap);
			if(depth==1) for(var y=0; y<h; y++) {  var s0 = y*bpl, t0 = y*w;
				for(var i=0; i<w; i++) { var qi=(t0+i)<<2, j=((data[s0+(i>>3)]>>(7-((i&7)<<0)))& 1), cj=3*j;  bf[qi]=p[cj];  bf[qi+1]=p[cj+1];  bf[qi+2]=p[cj+2];  bf[qi+3]=(j<tl)?ap[j]:255;  }
			}
			if(depth==2) for(var y=0; y<h; y++) {  var s0 = y*bpl, t0 = y*w;
				for(var i=0; i<w; i++) { var qi=(t0+i)<<2, j=((data[s0+(i>>2)]>>(6-((i&3)<<1)))& 3), cj=3*j;  bf[qi]=p[cj];  bf[qi+1]=p[cj+1];  bf[qi+2]=p[cj+2];  bf[qi+3]=(j<tl)?ap[j]:255;  }
			}
			if(depth==4) for(var y=0; y<h; y++) {  var s0 = y*bpl, t0 = y*w;
				for(var i=0; i<w; i++) { var qi=(t0+i)<<2, j=((data[s0+(i>>1)]>>(4-((i&1)<<2)))&15), cj=3*j;  bf[qi]=p[cj];  bf[qi+1]=p[cj+1];  bf[qi+2]=p[cj+2];  bf[qi+3]=(j<tl)?ap[j]:255;  }
			}
			if(depth==8) for(var i=0; i<area; i++ ) {  var qi=i<<2, j=data[i]                      , cj=3*j;  bf[qi]=p[cj];  bf[qi+1]=p[cj+1];  bf[qi+2]=p[cj+2];  bf[qi+3]=(j<tl)?ap[j]:255;  }
		}
		else if(ctype==4) {	// gray + alpha
			if(depth== 8)  for(var i=0; i<area; i++) {  var qi=i<<2, di=i<<1, gr=data[di];  bf[qi]=gr;  bf[qi+1]=gr;  bf[qi+2]=gr;  bf[qi+3]=data[di+1];  }
			if(depth==16)  for(var i=0; i<area; i++) {  var qi=i<<2, di=i<<2, gr=data[di];  bf[qi]=gr;  bf[qi+1]=gr;  bf[qi+2]=gr;  bf[qi+3]=data[di+2];  }
		}
		else if(ctype==0) {	// gray
			var tr = out.tabs["tRNS"] ? out.tabs["tRNS"] : -1;
			for(var y=0; y<h; y++) {
				var off = y*bpl, to = y*w;
				if     (depth== 1) for(var x=0; x<w; x++) {  var gr=255*((data[off+(x>>>3)]>>>(7 -((x&7)   )))& 1), al=(gr==tr*255)?0:255;  bf32[to+x]=(al<<24)|(gr<<16)|(gr<<8)|gr;  }
				else if(depth== 2) for(var x=0; x<w; x++) {  var gr= 85*((data[off+(x>>>2)]>>>(6 -((x&3)<<1)))& 3), al=(gr==tr* 85)?0:255;  bf32[to+x]=(al<<24)|(gr<<16)|(gr<<8)|gr;  }
				else if(depth== 4) for(var x=0; x<w; x++) {  var gr= 17*((data[off+(x>>>1)]>>>(4 -((x&1)<<2)))&15), al=(gr==tr* 17)?0:255;  bf32[to+x]=(al<<24)|(gr<<16)|(gr<<8)|gr;  }
				else if(depth== 8) for(var x=0; x<w; x++) {  var gr=data[off+     x], al=(gr                 ==tr)?0:255;  bf32[to+x]=(al<<24)|(gr<<16)|(gr<<8)|gr;  }
				else if(depth==16) for(var x=0; x<w; x++) {  var gr=data[off+(x<<1)], al=(rs(data,off+(x<<1))==tr)?0:255;  bf32[to+x]=(al<<24)|(gr<<16)|(gr<<8)|gr;  }
			}
		}
		//console.log(Date.now()-time);
		return bf;
	}



	function decode(buff)
	{
		var data = new Uint8Array(buff), offset = 8, bin = _bin, rUs = bin.readUshort, rUi = bin.readUint;
		var out = {tabs:{}, frames:[]};
		var dd = new Uint8Array(data.length), doff = 0;	 // put all IDAT data into it
		var fd, foff = 0;	// frames
		
		var mgck = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
		for(var i=0; i<8; i++) if(data[i]!=mgck[i]) throw "The input is not a PNG file!";

		while(offset<data.length)
		{
			var len  = bin.readUint(data, offset);  offset += 4;
			var type = bin.readASCII(data, offset, 4);  offset += 4;
			//console.log(type,len);
			
			if     (type=="IHDR")  {  _IHDR(data, offset, out);  }
			else if(type=="iCCP")  {
				var off = offset;  while(data[off]!=0) off++;
				var nam = bin.readASCII(data,offset,off-offset);
				var cpr = data[off+1];
				var fil = data.slice(off+2,offset+len);
				var res = null;
				try { res = _inflate(fil); } catch(e) {  res = inflateRaw(fil);  }
				out.tabs[type] = res;
			}
			else if(type=="CgBI")  {  out.tabs[type] = data.slice(offset,offset+4);  }
			else if(type=="IDAT") {
				for(var i=0; i<len; i++) dd[doff+i] = data[offset+i];
				doff += len;
			}
			else if(type=="acTL")  {
				out.tabs[type] = {  num_frames:rUi(data, offset), num_plays:rUi(data, offset+4)  };
				fd = new Uint8Array(data.length);
			}
			else if(type=="fcTL")  {
				if(foff!=0) {  var fr = out.frames[out.frames.length-1];
					fr.data = _decompress(out, fd.slice(0,foff), fr.rect.width, fr.rect.height);  foff=0;
				}
				var rct = {x:rUi(data, offset+12),y:rUi(data, offset+16),width:rUi(data, offset+4),height:rUi(data, offset+8)};
				var del = rUs(data, offset+22);  del = rUs(data, offset+20) / (del==0?100:del);
				var frm = {rect:rct, delay:Math.round(del*1000), dispose:data[offset+24], blend:data[offset+25]};
				//console.log(frm);
				out.frames.push(frm);
			}
			else if(type=="fdAT") {
				for(var i=0; i<len-4; i++) fd[foff+i] = data[offset+i+4];
				foff += len-4;
			}
			else if(type=="pHYs") {
				out.tabs[type] = [bin.readUint(data, offset), bin.readUint(data, offset+4), data[offset+8]];
			}
			else if(type=="cHRM") {
				out.tabs[type] = [];
				for(var i=0; i<8; i++) out.tabs[type].push(bin.readUint(data, offset+i*4));
			}
			else if(type=="tEXt" || type=="zTXt") {
				if(out.tabs[type]==null) out.tabs[type] = {};
				var nz = bin.nextZero(data, offset);
				var keyw = bin.readASCII(data, offset, nz-offset);
				var text, tl=offset+len-nz-1;
				if(type=="tEXt") text = bin.readASCII(data, nz+1, tl);
				else {
					var bfr = _inflate(data.slice(nz+2,nz+2+tl));
					text = bin.readUTF8(bfr,0,bfr.length);
				}
				out.tabs[type][keyw] = text;
			}
			else if(type=="iTXt") {
				if(out.tabs[type]==null) out.tabs[type] = {};
				var nz = 0, off = offset;
				nz = bin.nextZero(data, off);
				var keyw = bin.readASCII(data, off, nz-off);  off = nz + 1;
				var cflag = data[off], cmeth = data[off+1];  off+=2;
				nz = bin.nextZero(data, off);
				var ltag = bin.readASCII(data, off, nz-off);  off = nz + 1;
				nz = bin.nextZero(data, off);
				var tkeyw = bin.readUTF8(data, off, nz-off);  off = nz + 1;
				var text, tl=len-(off-offset);
				if(cflag==0) text  = bin.readUTF8(data, off, tl);
				else {
					var bfr = _inflate(data.slice(off,off+tl));
					text = bin.readUTF8(bfr,0,bfr.length);
				}
				out.tabs[type][keyw] = text;
			}
			else if(type=="PLTE") {
				out.tabs[type] = bin.readBytes(data, offset, len);
			}
			else if(type=="hIST") {
				var pl = out.tabs["PLTE"].length/3;
				out.tabs[type] = [];  for(var i=0; i<pl; i++) out.tabs[type].push(rUs(data, offset+i*2));
			}
			else if(type=="tRNS") {
				if     (out.ctype==3) out.tabs[type] = bin.readBytes(data, offset, len);
				else if(out.ctype==0) out.tabs[type] = rUs(data, offset);
				else if(out.ctype==2) out.tabs[type] = [ rUs(data,offset),rUs(data,offset+2),rUs(data,offset+4) ];
				//else console.log("tRNS for unsupported color type",out.ctype, len);
			}
			else if(type=="gAMA") out.tabs[type] = bin.readUint(data, offset)/100000;
			else if(type=="sRGB") out.tabs[type] = data[offset];
			else if(type=="bKGD")
			{
				if     (out.ctype==0 || out.ctype==4) out.tabs[type] = [rUs(data, offset)];
				else if(out.ctype==2 || out.ctype==6) out.tabs[type] = [rUs(data, offset), rUs(data, offset+2), rUs(data, offset+4)];
				else if(out.ctype==3) out.tabs[type] = data[offset];
			}
			else if(type=="IEND") {
				break;
			}
			//else {  console.log("unknown chunk type", type, len);  out.tabs[type]=data.slice(offset,offset+len);  }
			offset += len;
			var crc = bin.readUint(data, offset);  offset += 4;
		}
		if(foff!=0) {  var fr = out.frames[out.frames.length-1];
			fr.data = _decompress(out, fd.slice(0,foff), fr.rect.width, fr.rect.height);
		}	
		out.data = _decompress(out, dd, out.width, out.height);
		
		delete out.compress;  delete out.interlace;  delete out.filter;
		return out;
	}

	function _decompress(out, dd, w, h) {
		var time = Date.now();
		var bpp = _getBPP(out), bpl = Math.ceil(w*bpp/8), buff = new Uint8Array((bpl+1+out.interlace)*h);
		if(out.tabs["CgBI"]) dd = inflateRaw(dd,buff);
		else                 dd = _inflate(dd,buff);
		//console.log(dd.length, buff.length);
		//console.log(Date.now()-time);

		var time=Date.now();
		if     (out.interlace==0) dd = _filterZero(dd, out, 0, w, h);
		else if(out.interlace==1) dd = _readInterlace(dd, out);
		//console.log(Date.now()-time);
		return dd;
	}

	function _inflate(data, buff) {  var out=inflateRaw(new Uint8Array(data.buffer, 2,data.length-6),buff);  return out;  }
	
	var inflateRaw=function(){var D=function(){var o=Uint16Array,j=Uint32Array;return{m:new o(16),v:new o(16),
	d:[16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15],o:[3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258,999,999,999],
	z:[0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0,0,0,0],B:new o(32),
	p:[1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577,65535,65535],
	w:[0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13,0,0],h:new j(32),g:new o(512),s:[],A:new o(32),t:[],k:new o(32768),c:[],
	a:[],n:new o(32768),e:[],C:new o(512),b:[],i:new o(1<<15),r:new j(286),f:new j(30),l:new j(19),u:new j(15e3),q:new o(1<<16),j:new o(1<<15)}}();
function C(o,j){var I=o.length,A,r,i,y,G,f=D.v;for(var y=0;y<=j;y++)f[y]=0;for(y=1;y<I;y+=2)f[o[y]]++;
var a=D.m;A=0;f[0]=0;for(r=1;r<=j;r++){A=A+f[r-1]<<1;a[r]=A}for(i=0;i<I;i+=2){G=o[i+1];if(G!=0){o[i]=a[G];
a[G]++}}}function t(o,j,I){var A=o.length,r=D.i;for(var i=0;i<A;i+=2)if(o[i+1]!=0){var y=i>>1,G=o[i+1],f=y<<4|G,a=j-G,k=o[i]<<a,N=k+(1<<a);
while(k!=N){var x=r[k]>>>15-j;I[x]=f;k++}}}function g(o,j){var I=D.i,A=15-j;for(var r=0;r<o.length;r+=2){var i=o[r]<<j-o[r+1];
o[r]=I[i]>>>A}}(function(){var o=1<<15;for(var j=0;j<o;j++){var I=j;I=(I&2863311530)>>>1|(I&1431655765)<<1;
I=(I&3435973836)>>>2|(I&858993459)<<2;I=(I&4042322160)>>>4|(I&252645135)<<4;I=(I&4278255360)>>>8|(I&16711935)<<8;
D.i[j]=(I>>>16|I<<16)>>>17}function A(r,i,y){while(i--!=0)r.push(0,y)}for(var j=0;j<32;j++){D.B[j]=D.o[j]<<3|D.z[j];
D.h[j]=D.p[j]<<4|D.w[j]}A(D.s,144,8);A(D.s,255-143,9);A(D.s,279-255,7);A(D.s,287-279,8);C(D.s,9);t(D.s,9,D.g);
g(D.s,9);A(D.t,32,5);C(D.t,5);t(D.t,5,D.A);g(D.t,5);A(D.b,19,0);A(D.c,286,0);A(D.e,30,0);A(D.a,320,0)}());
function F(o,j,I){return(o[j>>>3]|o[(j>>>3)+1]<<8)>>>(j&7)&(1<<I)-1}function s(o,j,I){return(o[j>>>3]|o[(j>>>3)+1]<<8|o[(j>>>3)+2]<<16)>>>(j&7)&(1<<I)-1}
function w(o,j){return(o[j>>>3]|o[(j>>>3)+1]<<8|o[(j>>>3)+2]<<16)>>>(j&7)}function b(o,j){return(o[j>>>3]|o[(j>>>3)+1]<<8|o[(j>>>3)+2]<<16|o[(j>>>3)+3]<<24)>>>(j&7)}
function v(o,j){var I=Uint8Array,r=0,i=0,y=0,G=0,f=0,a=0,k=0,N=0,x=0,P,J;
if(o[0]==3&&o[1]==0)return j?j:new I(0);var A=j==null;if(A)j=new I(o.length>>>2<<3);while(r==0){r=s(o,x,1);
i=s(o,x+1,2);x+=3;if(i==0){if((x&7)!=0)x+=8-(x&7);var K=(x>>>3)+4,m=o[K-4]|o[K-3]<<8;if(A)j=H(j,N+m);
j.set(new I(o.buffer,o.byteOffset+K,m),N);x=K+m<<3;N+=m;continue}if(A)j=H(j,N+(1<<17));if(i==1){P=D.g;
J=D.A;a=(1<<9)-1;k=(1<<5)-1}if(i==2){y=F(o,x,5)+257;G=F(o,x+5,5)+1;f=F(o,x+10,4)+4;x+=14;var O=x,Q=1;
for(var p=0;p<38;p+=2){D.b[p]=0;D.b[p+1]=0}for(var p=0;p<f;p++){var l=F(o,x+p*3,3);D.b[(D.d[p]<<1)+1]=l;
if(l>Q)Q=l}x+=3*f;C(D.b,Q);t(D.b,Q,D.C);P=D.k;J=D.n;x=B(D.C,(1<<Q)-1,y+G,o,x,D.a);var u=d(D.a,0,y,D.c);
a=(1<<u)-1;var n=d(D.a,y,G,D.e);k=(1<<n)-1;C(D.c,u);t(D.c,u,P);C(D.e,n);t(D.e,n,J)}while(!0){var h=P[w(o,x)&a];
x+=h&15;var L=h>>>4;if(L>>>8==0){j[N++]=L}else if(L==256){break}else{var M=N+L-254;if(L>264){var z=D.B[L-257];
M=N+(z>>>3)+F(o,x,z&7);x+=z&7}var e=J[w(o,x)&k];x+=e&15;var E=e>>>4,c=D.h[E],q=(c>>>4)+s(o,x,c&15);x+=c&15;
if(A)j=H(j,N+(1<<17));while(N<M){j[N]=j[N++-q];j[N]=j[N++-q];j[N]=j[N++-q];j[N]=j[N++-q]}N=M}}}return j.length==N?j:j.slice(0,N)}function H(o,j){var I=o.length;
if(j<=I)return o;var A=new Uint8Array(Math.max(I<<1,j));A.set(o,0);return A}function B(o,j,I,A,r,i){var y=0;
while(y<I){var G=o[w(A,r)&j];r+=G&15;var f=G>>>4;if(f<=15){i[y]=f;y++}else{var a=0,k=0;if(f==16){k=3+F(A,r,2);
r+=2;a=i[y-1]}else if(f==17){k=3+F(A,r,3);r+=3}else if(f==18){k=11+F(A,r,7);r+=7}var N=y+k;while(y<N){i[y]=a;
y++}}}return r}function d(o,j,I,A){var r=0,i=0,y=A.length>>>1;while(i<I){var G=o[i+j];A[i<<1]=0;A[(i<<1)+1]=G;
if(G>r)r=G;i++}while(i<y){A[i<<1]=0;A[(i<<1)+1]=0;i++}return r}return v}();


	function _readInterlace(data, out)
	{
		var w = out.width, h = out.height;
		var bpp = _getBPP(out), cbpp = bpp>>3, bpl = Math.ceil(w*bpp/8);
		var img = new Uint8Array( h * bpl );
		var di = 0;

		var starting_row  = [ 0, 0, 4, 0, 2, 0, 1 ];
		var starting_col  = [ 0, 4, 0, 2, 0, 1, 0 ];
		var row_increment = [ 8, 8, 8, 4, 4, 2, 2 ];
		var col_increment = [ 8, 8, 4, 4, 2, 2, 1 ];

		var pass=0;
		while(pass<7)
		{
			var ri = row_increment[pass], ci = col_increment[pass];
			var sw = 0, sh = 0;
			var cr = starting_row[pass];  while(cr<h) {  cr+=ri;  sh++;  }
			var cc = starting_col[pass];  while(cc<w) {  cc+=ci;  sw++;  }
			var bpll = Math.ceil(sw*bpp/8);
			_filterZero(data, out, di, sw, sh);

			var y=0, row = starting_row[pass];
			while(row<h)
			{
				var col = starting_col[pass];
				var cdi = (di+y*bpll)<<3;

				while(col<w)
				{
					if(bpp==1) {
						var val = data[cdi>>3];  val = (val>>(7-(cdi&7)))&1;
						img[row*bpl + (col>>3)] |= (val << (7-((col&7)<<0)));
					}
					if(bpp==2) {
						var val = data[cdi>>3];  val = (val>>(6-(cdi&7)))&3;
						img[row*bpl + (col>>2)] |= (val << (6-((col&3)<<1)));
					}
					if(bpp==4) {
						var val = data[cdi>>3];  val = (val>>(4-(cdi&7)))&15;
						img[row*bpl + (col>>1)] |= (val << (4-((col&1)<<2)));
					}
					if(bpp>=8) {
						var ii = row*bpl+col*cbpp;
						for(var j=0; j<cbpp; j++) img[ii+j] = data[(cdi>>3)+j];
					}
					cdi+=bpp;  col+=ci;
				}
				y++;  row += ri;
			}
			if(sw*sh!=0) di += sh * (1 + bpll);
			pass = pass + 1;
		}
		return img;
	}

	function _getBPP(out) {
		var noc = [1,null,3,1,2,null,4][out.ctype];
		return noc * out.depth;
	}

	function _filterZero(data, out, off, w, h)
	{
		var bpp = _getBPP(out), bpl = Math.ceil(w*bpp/8);
		bpp = Math.ceil(bpp/8);
		
		var i,di, type=data[off], x=0;
		
		if(type>1) data[off]=[0,0,1][type-2];  
		if(type==3) for(x=bpp; x<bpl; x++) data[x+1] = (data[x+1] + (data[x+1-bpp]>>>1) )&255;

		for(var y=0; y<h; y++)  {
			i = off+y*bpl; di = i+y+1;
			type = data[di-1]; x=0;

			if     (type==0)   for(; x<bpl; x++) data[i+x] = data[di+x];
			else if(type==1) { for(; x<bpp; x++) data[i+x] = data[di+x];
							   for(; x<bpl; x++) data[i+x] = (data[di+x] + data[i+x-bpp]);  }
			else if(type==2) { for(; x<bpl; x++) data[i+x] = (data[di+x] + data[i+x-bpl]);  }
			else if(type==3) { for(; x<bpp; x++) data[i+x] = (data[di+x] + ( data[i+x-bpl]>>>1));
							   for(; x<bpl; x++) data[i+x] = (data[di+x] + ((data[i+x-bpl]+data[i+x-bpp])>>>1) );  }
			else             { for(; x<bpp; x++) data[i+x] = (data[di+x] + _paeth(0, data[i+x-bpl], 0));
							   for(; x<bpl; x++) data[i+x] = (data[di+x] + _paeth(data[i+x-bpp], data[i+x-bpl], data[i+x-bpp-bpl]) );  }
		}
		return data;
	}

	function _paeth(a,b,c)
	{
		var p = a+b-c, pa = (p-a), pb = (p-b), pc = (p-c);
		if (pa*pa <= pb*pb && pa*pa <= pc*pc)  return a;
		else if (pb*pb <= pc*pc)  return b;
		return c;
	}

	function _IHDR(data, offset, out)
	{
		out.width  = _bin.readUint(data, offset);  offset += 4;
		out.height = _bin.readUint(data, offset);  offset += 4;
		out.depth     = data[offset];  offset++;
		out.ctype     = data[offset];  offset++;
		out.compress  = data[offset];  offset++;
		out.filter    = data[offset];  offset++;
		out.interlace = data[offset];  offset++;
	}

	function _copyTile(sb, sw, sh, tb, tw, th, xoff, yoff, mode)
	{
		var w = Math.min(sw,tw), h = Math.min(sh,th);
		var si=0, ti=0;
		for(var y=0; y<h; y++)
			for(var x=0; x<w; x++)
			{
				if(xoff>=0 && yoff>=0) {  si = (y*sw+x)<<2;  ti = (( yoff+y)*tw+xoff+x)<<2;  }
				else                   {  si = ((-yoff+y)*sw-xoff+x)<<2;  ti = (y*tw+x)<<2;  }
				
				if     (mode==0) {  tb[ti] = sb[si];  tb[ti+1] = sb[si+1];  tb[ti+2] = sb[si+2];  tb[ti+3] = sb[si+3];  }
				else if(mode==1) {
					var fa = sb[si+3]*(1/255), fr=sb[si]*fa, fg=sb[si+1]*fa, fb=sb[si+2]*fa; 
					var ba = tb[ti+3]*(1/255), br=tb[ti]*ba, bg=tb[ti+1]*ba, bb=tb[ti+2]*ba; 
					
					var ifa=1-fa, oa = fa+ba*ifa, ioa = (oa==0?0:1/oa);
					tb[ti+3] = 255*oa;  
					tb[ti+0] = (fr+br*ifa)*ioa;  
					tb[ti+1] = (fg+bg*ifa)*ioa;   
					tb[ti+2] = (fb+bb*ifa)*ioa;  
				}
				else if(mode==2){	// copy only differences, otherwise zero
					var fa = sb[si+3], fr=sb[si], fg=sb[si+1], fb=sb[si+2]; 
					var ba = tb[ti+3], br=tb[ti], bg=tb[ti+1], bb=tb[ti+2]; 
					if(fa==ba && fr==br && fg==bg && fb==bb) {  tb[ti]=0;  tb[ti+1]=0;  tb[ti+2]=0;  tb[ti+3]=0;  }
					else {  tb[ti]=fr;  tb[ti+1]=fg;  tb[ti+2]=fb;  tb[ti+3]=fa;  }
				}
				else if(mode==3){	// check if can be blended
					var fa = sb[si+3], fr=sb[si], fg=sb[si+1], fb=sb[si+2]; 
					var ba = tb[ti+3], br=tb[ti], bg=tb[ti+1], bb=tb[ti+2]; 
					if(fa==ba && fr==br && fg==bg && fb==bb) continue;
					//if(fa!=255 && ba!=0) return false;
					if(fa<220 && ba>20) return false;
				}
			}
		return true;
	}
	
	return {
		decode:decode,
		toRGBA8:toRGBA8,
		_paeth:_paeth,
		_copyTile:_copyTile,
		_bin:_bin
	};

})();









(function() {
	var _copyTile = __UPNG__._copyTile, _bin=__UPNG__._bin, paeth = __UPNG__._paeth;
	var crcLib = {
		table : ( function() {
		   var tab = new Uint32Array(256);
		   for (var n=0; n<256; n++) {
				var c = n;
				for (var k=0; k<8; k++) {
					if (c & 1)  c = 0xedb88320 ^ (c >>> 1);
					else        c = c >>> 1;
				}
				tab[n] = c;  }
			return tab;  })(),
		update : function(c, buf, off, len) {
			for (var i=0; i<len; i++)  c = crcLib.table[(c ^ buf[off+i]) & 0xff] ^ (c >>> 8);
			return c;
		},
		crc : function(b,o,l)  {  return crcLib.update(0xffffffff,b,o,l) ^ 0xffffffff;  }
	}
	
	
	function addErr(er, tg, ti, f) {
		tg[ti]+=(er[0]*f)>>4;  tg[ti+1]+=(er[1]*f)>>4;  tg[ti+2]+=(er[2]*f)>>4;  tg[ti+3]+=(er[3]*f)>>4;  
	}
	function N(x) {  return Math.max(0, Math.min(255, x));  }
	function D(a,b) {  var dr=a[0]-b[0], dg=a[1]-b[1], db=a[2]-b[2], da=a[3]-b[3];  return (dr*dr + dg*dg + db*db + da*da);  }
		
	// MTD: 0: None, 1: floyd-steinberg, 2: Bayer
	function dither(sb, w, h, plte, tb, oind, MTD) {
		if(MTD==null) MTD=1;		
		
		var pc=plte.length, nplt = [], rads=[];
		for(var i=0; i<pc; i++) {
			var c = plte[i];
			nplt.push([((c>>>0)&255), ((c>>>8)&255), ((c>>>16)&255), ((c>>>24)&255)]);
		}
		for(var i=0; i<pc; i++) {
			var ne=0xffffffff, ni=0;
			for(var j=0; j<pc; j++) {  var ce=D(nplt[i],nplt[j]);  if(j!=i && ce<ne) {  ne=ce;  ni=j;  }  }
			var hd = Math.sqrt(ne)/2;
			rads[i] = ~~(hd*hd);
		}
			
		var tb32 = new Uint32Array(tb.buffer);
		var err = new Int16Array(w*h*4);
		
		/*
		var S=2, M = [
			0,2,
		    3,1];  //*/
		//*
		var S=4, M = [
			 0, 8, 2,10,
		    12, 4,14, 6,
			 3,11, 1, 9,
			15, 7,13, 5 ];  //*/
		for(var i=0; i<M.length; i++) M[i] = 255*(-0.5 + (M[i]+0.5)/(S*S));
		
		for(var y=0; y<h; y++) {
			for(var x=0; x<w; x++) {
				var i = (y*w+x)*4;
				
				var cc;
				if(MTD!=2) cc = [N(sb[i]+err[i]), N(sb[i+1]+err[i+1]), N(sb[i+2]+err[i+2]), N(sb[i+3]+err[i+3])];
				else {
					var ce = M[(y&(S-1))*S+(x&(S-1))];
					cc = [N(sb[i]+ce), N(sb[i+1]+ce), N(sb[i+2]+ce), N(sb[i+3]+ce)];
				}
				
				var ni=0, nd = 0xffffff;
				for(var j=0; j<pc; j++) {
					var cd = D(cc,nplt[j]);
					if(cd<nd) {  nd=cd;  ni=j;  }
				}  
				
				var nc = nplt[ni];
				var er = [cc[0]-nc[0], cc[1]-nc[1], cc[2]-nc[2], cc[3]-nc[3]];
				
				if(MTD==1) {
					//addErr(er, err, i+4, 16);
					if(x!=w-1) addErr(er, err, i+4    , 7);
					if(y!=h-1) {
						if(x!=  0) addErr(er, err, i+4*w-4, 3);
								   addErr(er, err, i+4*w  , 5);
						if(x!=w-1) addErr(er, err, i+4*w+4, 1);  
					}//*/
				}
				oind[i>>2] = ni;  tb32[i>>2] = plte[ni];
			}
		}
	}

	
	function encode(bufs, w, h, ps, dels, tabs, forbidPlte)
	{
		if(ps==null) ps=0;
		if(forbidPlte==null) forbidPlte = false;

		var nimg = compress(bufs, w, h, ps, [false, false, false, 0, forbidPlte,false]);
		compressPNG(nimg, -1);
		
		return _main(nimg, w, h, dels, tabs);
	}

	function encodeLL(bufs, w, h, cc, ac, depth, dels, tabs) {
		var nimg = {  ctype: 0 + (cc==1 ? 0 : 2) + (ac==0 ? 0 : 4),      depth: depth,  frames: []  };
		
		var time = Date.now();
		var bipp = (cc+ac)*depth, bipl = bipp * w;
		for(var i=0; i<bufs.length; i++)
			nimg.frames.push({  rect:{x:0,y:0,width:w,height:h},  img:new Uint8Array(bufs[i]), blend:0, dispose:1, bpp:Math.ceil(bipp/8), bpl:Math.ceil(bipl/8)  });
		
		compressPNG(nimg, 0, true);
		
		var out = _main(nimg, w, h, dels, tabs);
		return out;
	}

	function _main(nimg, w, h, dels, tabs) {
		if(tabs==null) tabs={};
		var crc = crcLib.crc, wUi = _bin.writeUint, wUs = _bin.writeUshort, wAs = _bin.writeASCII;
		var offset = 8, anim = nimg.frames.length>1, pltAlpha = false;
		
		var cicc;
		
		var leng = 8 + (16+5+4) /*+ (9+4)*/ + (anim ? 20 : 0);
		if(tabs["sRGB"]!=null) leng += 8+1+4;
		if(tabs["pHYs"]!=null) leng += 8+9+4;
		if(tabs["iCCP"]!=null) {  cicc = pako.deflate(tabs["iCCP"]);  leng += 8 + 11 + 2 + cicc.length + 4;  }
		if(nimg.ctype==3) {
			var dl = nimg.plte.length;
			for(var i=0; i<dl; i++) if((nimg.plte[i]>>>24)!=255) pltAlpha = true;
			leng += (8 + dl*3 + 4) + (pltAlpha ? (8 + dl*1 + 4) : 0);
		}
		for(var j=0; j<nimg.frames.length; j++)
		{
			var fr = nimg.frames[j];
			if(anim) leng += 38;
			leng += fr.cimg.length + 12;
			if(j!=0) leng+=4;
		}
		leng += 12; 
		
		var data = new Uint8Array(leng);
		var wr=[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
		for(var i=0; i<8; i++) data[i]=wr[i];
		
		wUi(data,offset, 13);     offset+=4;
		wAs(data,offset,"IHDR");  offset+=4;
		wUi(data,offset,w);  offset+=4;
		wUi(data,offset,h);  offset+=4;
		data[offset] = nimg.depth;  offset++;  // depth
		data[offset] = nimg.ctype;  offset++;  // ctype
		data[offset] = 0;  offset++;  // compress
		data[offset] = 0;  offset++;  // filter
		data[offset] = 0;  offset++;  // interlace
		wUi(data,offset,crc(data,offset-17,17));  offset+=4; // crc

		// 13 bytes to say, that it is sRGB
		if(tabs["sRGB"]!=null) {
			wUi(data,offset, 1);      offset+=4;
			wAs(data,offset,"sRGB");  offset+=4;
			data[offset] = tabs["sRGB"];  offset++;
			wUi(data,offset,crc(data,offset-5,5));  offset+=4; // crc
		}
		if(tabs["iCCP"]!=null) {
			var sl = 11+2+cicc.length;
			wUi(data,offset, sl);  offset+=4;
			wAs(data,offset,"iCCP");  offset+=4;
			wAs(data,offset,"ICC profile");  offset+=11;  offset+=2;
			data.set(cicc, offset);  offset+=cicc.length;
			wUi(data,offset,crc(data,offset-(sl+4),sl+4));  offset+=4; // crc
		}
		if(tabs["pHYs"]!=null) {
			wUi(data,offset, 9);      offset+=4;
			wAs(data,offset,"pHYs");  offset+=4;
			wUi(data,offset, tabs["pHYs"][0]);      offset+=4;
			wUi(data,offset, tabs["pHYs"][1]);      offset+=4;
			data[offset]=tabs["pHYs"][2];			offset++;
			wUi(data,offset,crc(data,offset-13,13));  offset+=4; // crc
		}

		if(anim) {
			wUi(data,offset, 8);      offset+=4;
			wAs(data,offset,"acTL");  offset+=4;
			wUi(data,offset, nimg.frames.length);     offset+=4;
			wUi(data,offset, tabs["loop"]!=null?tabs["loop"]:0);      offset+=4;
			wUi(data,offset,crc(data,offset-12,12));  offset+=4; // crc
		}

		if(nimg.ctype==3) {
			var dl = nimg.plte.length;
			wUi(data,offset, dl*3);  offset+=4;
			wAs(data,offset,"PLTE");  offset+=4;
			for(var i=0; i<dl; i++){
				var ti=i*3, c=nimg.plte[i], r=(c)&255, g=(c>>>8)&255, b=(c>>>16)&255;
				data[offset+ti+0]=r;  data[offset+ti+1]=g;  data[offset+ti+2]=b;
			}
			offset+=dl*3;
			wUi(data,offset,crc(data,offset-dl*3-4,dl*3+4));  offset+=4; // crc

			if(pltAlpha) {
				wUi(data,offset, dl);  offset+=4;
				wAs(data,offset,"tRNS");  offset+=4;
				for(var i=0; i<dl; i++)  data[offset+i]=(nimg.plte[i]>>>24)&255;
				offset+=dl;
				wUi(data,offset,crc(data,offset-dl-4,dl+4));  offset+=4; // crc
			}
		}
		
		var fi = 0;
		for(var j=0; j<nimg.frames.length; j++)
		{
			var fr = nimg.frames[j];
			if(anim) {
				wUi(data, offset, 26);     offset+=4;
				wAs(data, offset,"fcTL");  offset+=4;
				wUi(data, offset, fi++);   offset+=4;
				wUi(data, offset, fr.rect.width );   offset+=4;
				wUi(data, offset, fr.rect.height);   offset+=4;
				wUi(data, offset, fr.rect.x);   offset+=4;
				wUi(data, offset, fr.rect.y);   offset+=4;
				wUs(data, offset, dels[j]);   offset+=2;
				wUs(data, offset,  1000);   offset+=2;
				data[offset] = fr.dispose;  offset++;	// dispose
				data[offset] = fr.blend  ;  offset++;	// blend
				wUi(data,offset,crc(data,offset-30,30));  offset+=4; // crc
			}
					
			var imgd = fr.cimg, dl = imgd.length;
			wUi(data,offset, dl+(j==0?0:4));     offset+=4;
			var ioff = offset;
			wAs(data,offset,(j==0)?"IDAT":"fdAT");  offset+=4;
			if(j!=0) {  wUi(data, offset, fi++);  offset+=4;  }
			data.set(imgd,offset);
			offset += dl;
			wUi(data,offset,crc(data,ioff,offset-ioff));  offset+=4; // crc
		}

		wUi(data,offset, 0);     offset+=4;
		wAs(data,offset,"IEND");  offset+=4;
		wUi(data,offset,crc(data,offset-4,4));  offset+=4; // crc

		return data.buffer;
	}

	function compressPNG(out, filter, levelZero) {
		for(var i=0; i<out.frames.length; i++) {
			var frm = out.frames[i], nw=frm.rect.width, nh=frm.rect.height;
			var fdata = new Uint8Array(nh*frm.bpl+nh);
			frm.cimg = _filterZero(frm.img,nh,frm.bpp,frm.bpl,fdata, filter, levelZero);
		}
	}



	function compress(bufs, w, h, ps, prms) // prms:  onlyBlend, minBits, forbidPlte
	{
		//var time = Date.now();
		var onlyBlend = prms[0], evenCrd = prms[1], forbidPrev = prms[2], minBits = prms[3], forbidPlte = prms[4], dith=prms[5];
		
		var ctype = 6, depth = 8, alphaAnd=255
		
		for(var j=0; j<bufs.length; j++)  {  // when not quantized, other frames can contain colors, that are not in an initial frame
			var img = new Uint8Array(bufs[j]), ilen = img.length;
			for(var i=0; i<ilen; i+=4) alphaAnd &= img[i+3];
		}
		var gotAlpha = (alphaAnd!=255);
		
		//console.log("alpha check", Date.now()-time);  time = Date.now();
		
		//var brute = gotAlpha && forGIF;		// brute : frames can only be copied, not "blended"
		var frms = framize(bufs, w, h, onlyBlend, evenCrd, forbidPrev);
		//console.log("framize", Date.now()-time);  time = Date.now();
		
		var cmap={}, plte=[], inds=[]; 
		
		if(ps!=0) {
			var nbufs = [];  for(var i=0; i<frms.length; i++) nbufs.push(frms[i].img.buffer);
			
			var abuf = concatRGBA(nbufs), qres = quantize(abuf, ps);
			
			for(var i=0; i<qres.plte.length; i++) plte.push(qres.plte[i].est.rgba);
			
			var cof = 0;
			for(var i=0; i<frms.length; i++) {  
				var frm=frms[i], bln=frm.img.length, ind = new Uint8Array(qres.inds.buffer, cof>>2, bln>>2);  inds.push(ind);
				var bb = new Uint8Array(qres.abuf,cof,bln);
				
				//console.log(frm.img, frm.width, frm.height);
				//var time = Date.now();
				if(dith) dither(frm.img, frm.rect.width, frm.rect.height, plte, bb, ind);
				//console.log(Date.now()-time);
				frm.img.set(bb);  cof+=bln;  
			}
			
			//console.log("quantize", Date.now()-time);  time = Date.now();
		}
		else {
			// what if ps==0, but there are <=256 colors?  we still need to detect, if the palette could be used
			for(var j=0; j<frms.length; j++)  {  // when not quantized, other frames can contain colors, that are not in an initial frame
				var frm = frms[j], img32 = new Uint32Array(frm.img.buffer), nw=frm.rect.width, ilen = img32.length;
				var ind = new Uint8Array(ilen);  inds.push(ind);
				for(var i=0; i<ilen; i++) {
					var c = img32[i];
					if     (i!=0 && c==img32[i- 1]) ind[i]=ind[i-1];
					else if(i>nw && c==img32[i-nw]) ind[i]=ind[i-nw];
					else {
						var cmc = cmap[c];
						if(cmc==null) {  cmap[c]=cmc=plte.length;  plte.push(c);  if(plte.length>=300) break;  }
						ind[i]=cmc;
					}
				}
			}
			//console.log("make palette", Date.now()-time);  time = Date.now();
		}
		
		var cc=plte.length; //console.log("colors:",cc);
		if(cc<=256 && forbidPlte==false) {
			if(cc<= 2) depth=1;  else if(cc<= 4) depth=2;  else if(cc<=16) depth=4;  else depth=8;
			depth =  Math.max(depth, minBits);
		}
		
		for(var j=0; j<frms.length; j++)
		{
			var frm = frms[j], nx=frm.rect.x, ny=frm.rect.y, nw=frm.rect.width, nh=frm.rect.height;
			var cimg = frm.img, cimg32 = new Uint32Array(cimg.buffer);
			var bpl = 4*nw, bpp=4;
			if(cc<=256 && forbidPlte==false) {
				bpl = Math.ceil(depth*nw/8);
				var nimg = new Uint8Array(bpl*nh);
				var inj = inds[j];
				for(var y=0; y<nh; y++) {  var i=y*bpl, ii=y*nw;
					if     (depth==8) for(var x=0; x<nw; x++) nimg[i+(x)   ]   =  (inj[ii+x]             );
					else if(depth==4) for(var x=0; x<nw; x++) nimg[i+(x>>1)]  |=  (inj[ii+x]<<(4-(x&1)*4));
					else if(depth==2) for(var x=0; x<nw; x++) nimg[i+(x>>2)]  |=  (inj[ii+x]<<(6-(x&3)*2));
					else if(depth==1) for(var x=0; x<nw; x++) nimg[i+(x>>3)]  |=  (inj[ii+x]<<(7-(x&7)*1));
				}
				cimg=nimg;  ctype=3;  bpp=1;
			}
			else if(gotAlpha==false && frms.length==1) {	// some next "reduced" frames may contain alpha for blending
				var nimg = new Uint8Array(nw*nh*3), area=nw*nh;
				for(var i=0; i<area; i++) { var ti=i*3, qi=i*4;  nimg[ti]=cimg[qi];  nimg[ti+1]=cimg[qi+1];  nimg[ti+2]=cimg[qi+2];  }
				cimg=nimg;  ctype=2;  bpp=3;  bpl=3*nw;
			}
			frm.img=cimg;  frm.bpl=bpl;  frm.bpp=bpp;
		}
		//console.log("colors => palette indices", Date.now()-time);  time = Date.now();
		
		return {ctype:ctype, depth:depth, plte:plte, frames:frms  };
	}
	function framize(bufs,w,h,alwaysBlend,evenCrd,forbidPrev) {
		/*  DISPOSE
			- 0 : no change
			- 1 : clear to transparent
			- 2 : retstore to content before rendering (previous frame disposed)
			BLEND
			- 0 : replace
			- 1 : blend
		*/
		var frms = [];
		for(var j=0; j<bufs.length; j++) {
			var cimg = new Uint8Array(bufs[j]), cimg32 = new Uint32Array(cimg.buffer);
			var nimg;
			
			var nx=0, ny=0, nw=w, nh=h, blend=alwaysBlend?1:0;
			if(j!=0) {
				var tlim = (forbidPrev || alwaysBlend || j==1 || frms[j-2].dispose!=0)?1:2, tstp = 0, tarea = 1e9;
				for(var it=0; it<tlim; it++)
				{
					var pimg = new Uint8Array(bufs[j-1-it]), p32 = new Uint32Array(bufs[j-1-it]);
					var mix=w,miy=h,max=-1,may=-1;
					for(var y=0; y<h; y++) for(var x=0; x<w; x++) {
						var i = y*w+x;
						if(cimg32[i]!=p32[i]) {
							if(x<mix) mix=x;  if(x>max) max=x;
							if(y<miy) miy=y;  if(y>may) may=y;
						}
					}
					if(max==-1) mix=miy=max=may=0;
					if(evenCrd) {  if((mix&1)==1)mix--;  if((miy&1)==1)miy--;  }
					var sarea = (max-mix+1)*(may-miy+1);
					if(sarea<tarea) {
						tarea = sarea;  tstp = it;
						nx = mix; ny = miy; nw = max-mix+1; nh = may-miy+1;
					}
				}
				
				// alwaysBlend: pokud zjistím, že blendit nelze, nastavím předchozímu snímku dispose=1. Zajistím, aby obsahoval můj obdélník.
				var pimg = new Uint8Array(bufs[j-1-tstp]);
				if(tstp==1) frms[j-1].dispose = 2;
				
				nimg = new Uint8Array(nw*nh*4);
				_copyTile(pimg,w,h, nimg,nw,nh, -nx,-ny, 0);
				
				blend =  _copyTile(cimg,w,h, nimg,nw,nh, -nx,-ny, 3) ? 1 : 0;
				if(blend==1) _prepareDiff(cimg,w,h,nimg,{x:nx,y:ny,width:nw,height:nh});
				else         _copyTile(cimg,w,h, nimg,nw,nh, -nx,-ny, 0);
			}
			else nimg = cimg.slice(0);	// img may be rewritten further ... don't rewrite input
			
			frms.push({rect:{x:nx,y:ny,width:nw,height:nh}, img:nimg, blend:blend, dispose:0});
		}
		
		
		if(alwaysBlend) for(var j=0; j<frms.length; j++) {
			var frm = frms[j];  if(frm.blend==1) continue;
			var r0 = frm.rect, r1 = frms[j-1].rect
			var miX = Math.min(r0.x, r1.x), miY = Math.min(r0.y, r1.y);
			var maX = Math.max(r0.x+r0.width, r1.x+r1.width), maY = Math.max(r0.y+r0.height, r1.y+r1.height);
			var r = {x:miX, y:miY, width:maX-miX, height:maY-miY};
			
			frms[j-1].dispose = 1;
			if(j-1!=0) 
			_updateFrame(bufs, w,h,frms, j-1,r, evenCrd);
			_updateFrame(bufs, w,h,frms, j  ,r, evenCrd);
		}
		var area = 0;
		if(bufs.length!=1) for(var i=0; i<frms.length; i++) {
			var frm = frms[i];
			area += frm.rect.width*frm.rect.height;
			//if(i==0 || frm.blend!=1) continue;
			//var ob = new Uint8Array(
			//console.log(frm.blend, frm.dispose, frm.rect);
		}
		//if(area!=0) console.log(area);
		return frms;
	}
	function _updateFrame(bufs, w,h, frms, i, r, evenCrd) {
		var U8 = Uint8Array, U32 = Uint32Array;
		var pimg = new U8(bufs[i-1]), pimg32 = new U32(bufs[i-1]), nimg = i+1<bufs.length ? new U8(bufs[i+1]):null;
		var cimg = new U8(bufs[i]), cimg32 = new U32(cimg.buffer);
		
		var mix=w,miy=h,max=-1,may=-1;
		for(var y=0; y<r.height; y++) for(var x=0; x<r.width; x++) {
			var cx = r.x+x, cy = r.y+y;
			var j = cy*w+cx, cc = cimg32[j];
			// no need to draw transparency, or to dispose it. Or, if writing the same color and the next one does not need transparency.
			if(cc==0 || (frms[i-1].dispose==0 && pimg32[j]==cc && (nimg==null || nimg[j*4+3]!=0))/**/) {}
			else {
				if(cx<mix) mix=cx;  if(cx>max) max=cx;
				if(cy<miy) miy=cy;  if(cy>may) may=cy;
			}
		}
		if(max==-1) mix=miy=max=may=0;
		if(evenCrd) {  if((mix&1)==1)mix--;  if((miy&1)==1)miy--;  }
		r = {x:mix, y:miy, width:max-mix+1, height:may-miy+1};
		
		var fr = frms[i];  fr.rect = r;  fr.blend = 1;  fr.img = new Uint8Array(r.width*r.height*4);
		if(frms[i-1].dispose==0) {
			_copyTile(pimg,w,h, fr.img,r.width,r.height, -r.x,-r.y, 0);
			_prepareDiff(cimg,w,h,fr.img,r);
		}
		else
			_copyTile(cimg,w,h, fr.img,r.width,r.height, -r.x,-r.y, 0);
	}
	function _prepareDiff(cimg, w,h, nimg, rec) {
		_copyTile(cimg,w,h, nimg,rec.width,rec.height, -rec.x,-rec.y, 2);
	}

	function _filterZero(img,h,bpp,bpl,data, filter, levelZero)
	{
		var fls = [], ftry=[0,1,2,3,4];
		if     (filter!=-1)             ftry=[filter];
		else if(h*bpl>500000 || bpp==1) ftry=[0];
		var opts;  if(levelZero) opts={level:0};
		
		
		var CMPR = (data.length>10e6 && _this.UZIP!=null) ? _this.UZIP : pako;
		
		var time = Date.now();
		for(var i=0; i<ftry.length; i++) {
			for(var y=0; y<h; y++) _filterLine(data, img, y, bpl, bpp, ftry[i]);
			//var nimg = new Uint8Array(data.length);
			//var sz = UZIP.F.deflate(data, nimg);  fls.push(nimg.slice(0,sz));
			//var dfl = pako["deflate"](data), dl=dfl.length-4;
			//var crc = (dfl[dl+3]<<24)|(dfl[dl+2]<<16)|(dfl[dl+1]<<8)|(dfl[dl+0]<<0);
			//console.log(crc, UZIP.adler(data,2,data.length-6));
			fls.push(CMPR["deflate"](data,opts));
		}
		
		var ti, tsize=1e9;
		for(var i=0; i<fls.length; i++) if(fls[i].length<tsize) {  ti=i;  tsize=fls[i].length;  }
		return fls[ti];
	}
	function _filterLine(data, img, y, bpl, bpp, type)
	{
		var i = y*bpl, di = i+y;
		data[di]=type;  di++;

		if(type==0) {
			if(bpl<500) for(var x=0; x<bpl; x++) data[di+x] = img[i+x];
			else data.set(new Uint8Array(img.buffer,i,bpl),di);
		}
		else if(type==1) {
			for(var x=  0; x<bpp; x++) data[di+x] =  img[i+x];
			for(var x=bpp; x<bpl; x++) data[di+x] = (img[i+x]-img[i+x-bpp]+256)&255;
		}
		else if(y==0) {
			for(var x=  0; x<bpp; x++) data[di+x] = img[i+x];

			if(type==2) for(var x=bpp; x<bpl; x++) data[di+x] = img[i+x];
			if(type==3) for(var x=bpp; x<bpl; x++) data[di+x] = (img[i+x] - (img[i+x-bpp]>>1) +256)&255;
			if(type==4) for(var x=bpp; x<bpl; x++) data[di+x] = (img[i+x] - paeth(img[i+x-bpp], 0, 0) +256)&255;
		}
		else {
			if(type==2) { for(var x=  0; x<bpl; x++) data[di+x] = (img[i+x]+256 - img[i+x-bpl])&255;  }
			if(type==3) { for(var x=  0; x<bpp; x++) data[di+x] = (img[i+x]+256 - (img[i+x-bpl]>>1))&255;
						  for(var x=bpp; x<bpl; x++) data[di+x] = (img[i+x]+256 - ((img[i+x-bpl]+img[i+x-bpp])>>1))&255;  }
			if(type==4) { for(var x=  0; x<bpp; x++) data[di+x] = (img[i+x]+256 - paeth(0, img[i+x-bpl], 0))&255;
						  for(var x=bpp; x<bpl; x++) data[di+x] = (img[i+x]+256 - paeth(img[i+x-bpp], img[i+x-bpl], img[i+x-bpp-bpl]))&255;  }
		}
	}


	function quantize(abuf, ps, doKmeans)
	{	
		var time = Date.now();
		var sb = new Uint8Array(abuf), tb = sb.slice(0), tb32 = new Uint32Array(tb.buffer);
		
		var KD = getKDtree(tb, ps);
		var root = KD[0], leafs = KD[1], K=leafs.length;
		
		//console.log(Date.now()-time, "tree made");  time = Date.now();
		
		var cl32 = new Uint32Array(K), clr8=new Uint8Array(cl32.buffer);
		for(var i=0; i<K; i++) cl32[i]=leafs[i].est.rgba;
		
		var len=sb.length;
			
		var inds = new Uint8Array(len>>2), nd;
		if(K<=60) {  findNearest(sb,inds,clr8);  remap(inds,tb32,cl32);  }
		else if(sb.length<32e6)  // precise, but slow :(
			//for(var j=0; j<4; j++) 
			for(var i=0; i<len; i+=4) {
				var r=sb[i]*(1/255), g=sb[i+1]*(1/255), b=sb[i+2]*(1/255), a=sb[i+3]*(1/255);
				
				nd = getNearest(root, r, g, b, a);
				inds[i>>2] = nd.ind;  tb32[i>>2] = nd.est.rgba;
			}
		else 
			for(var i=0; i<len; i+=4) {
				var r=sb[i]*(1/255), g=sb[i+1]*(1/255), b=sb[i+2]*(1/255), a=sb[i+3]*(1/255);
				
				nd = root;  while(nd.left) nd = (planeDst(nd.est,r,g,b,a)<=0) ? nd.left : nd.right;
				inds[i>>2] = nd.ind;  tb32[i>>2] = nd.est.rgba;
			}
			
		//console.log(Date.now()-time, "nearest found");  time = Date.now();
		
		if(doKmeans || sb.length*K<10*4e6) {
			var le = 1e9;
			for(var i=0; i<10; i++) {
				var ce = kmeans(sb, inds, clr8);  //console.log(i,ce);
				if(ce/le>0.997) break;  le=ce;
			}
			for(var i=0; i<K; i++) leafs[i].est.rgba = cl32[i];
			remap(inds,tb32,cl32);
			//console.log(Date.now()-time, "k-means");
		}
		
		return {  abuf:tb.buffer, inds:inds, plte:leafs  };
	}
	
	function remap(inds,tb32,pl32) {  for(var i=0; i<inds.length; i++) tb32[i]=pl32[inds[i]];  }
	function kmeans(sb,inds,plte) {
		updatePalette(sb,inds,plte);
		var err = findNearest(sb,inds,plte);
		return err;
	}
	
	function updatePalette(sb,inds,plte) {
		var K = plte.length>>>2;
		var sums = new Uint32Array(K*4), cnts = new Uint32Array(K);
		
		for(var i=0; i<sb.length; i+=4) {
			var ind = inds[i>>>2], qi=ind*4;
			cnts[ind]++;
			sums[qi  ]+=sb[i  ];  sums[qi+1]+=sb[i+1];
			sums[qi+2]+=sb[i+2];  sums[qi+3]+=sb[i+3];
		}
		for(var i=0; i<plte.length; i++) plte[i]=Math.round(sums[i]/cnts[i>>>2]);
	}
	
	function findNearest(sb,inds,plte) {
		var terr = 0, K=plte.length>>>2;
		
		var nd = [];  // squared half-distance to the nearest color
		for(var i=0; i<K; i++) {
			var qi=i*4;
			var r=plte[qi], g=plte[qi+1], b=plte[qi+2], a=plte[qi+3], ti=0, te=1e9;
			for(var j=0; j<K; j++) {
				if(i==j) continue;
				var qj=j*4, dr=r-plte[qj], dg=g-plte[qj+1], db=b-plte[qj+2], da=a-plte[qj+3];
				var err = dr*dr+dg*dg+db*db+da*da;
				if(err<te) {te=err;  ti=j;}
			}
			nd[i] = Math.sqrt(te)*0.5;  nd[i]=nd[i]*nd[i];
		}
		
		for(var i=0; i<sb.length; i+=4) {
			var r=sb[i  ], g=sb[i+1], b=sb[i+2], a=sb[i+3];
			var ti=inds[i>>>2], qi=ti*4, dr=r-plte[qi], dg=g-plte[qi+1], db=b-plte[qi+2], da=a-plte[qi+3], te = dr*dr+dg*dg+db*db+da*da;
			if(te>nd[ti]) for(var j=0; j<K; j++) {
				qi=j*4; dr=r-plte[qi]; dg=g-plte[qi+1]; db=b-plte[qi+2]; da=a-plte[qi+3];
				var err = dr*dr+dg*dg+db*db+da*da;
				if(err<te) {te=err;  ti=j;  if(te<nd[j]) break; }
			}
			inds[i>>>2]=ti;
			terr+=te;
		}
		return terr/(sb.length>>>2);
	}

	function getKDtree(nimg, ps, err) {
		if(err==null) err = 0.0001;
		var nimg32 = new Uint32Array(nimg.buffer);
		
		var root = {i0:0, i1:nimg.length, bst:null, est:null, tdst:0, left:null, right:null };  // basic statistic, extra statistic
		root.bst = stats(  nimg,root.i0, root.i1  );  root.est = estats( root.bst );
		var leafs = [root];
		
		while(leafs.length<ps)
		{
			var maxL = 0, mi=0;
			for(var i=0; i<leafs.length; i++) if(leafs[i].est.L > maxL) {  maxL=leafs[i].est.L;  mi=i;  }
			if(maxL<err) break;
			var node = leafs[mi];
			
			var s0 = splitPixels(nimg,nimg32, node.i0, node.i1, node.est.e, node.est.eMq255);
			var s0wrong = (node.i0>=s0 || node.i1<=s0);
			//console.log(maxL, leafs.length, mi);
			if(s0wrong) {  node.est.L=0;  continue;  }
			
			
			var ln = {i0:node.i0, i1:s0, bst:null, est:null, tdst:0, left:null, right:null };  ln.bst = stats( nimg, ln.i0, ln.i1 );  
			ln.est = estats( ln.bst );
			var rn = {i0:s0, i1:node.i1, bst:null, est:null, tdst:0, left:null, right:null };  rn.bst = {R:[], m:[], N:node.bst.N-ln.bst.N};
			for(var i=0; i<16; i++) rn.bst.R[i] = node.bst.R[i]-ln.bst.R[i];
			for(var i=0; i< 4; i++) rn.bst.m[i] = node.bst.m[i]-ln.bst.m[i];
			rn.est = estats( rn.bst );
			
			node.left = ln;  node.right = rn;
			leafs[mi]=ln;  leafs.push(rn);
		}
		leafs.sort(function(a,b) {  return b.bst.N-a.bst.N;  });
		for(var i=0; i<leafs.length; i++) leafs[i].ind=i;
		return [root, leafs];
	}

	function getNearest(nd, r,g,b,a)
	{
		if(nd.left==null) {  nd.tdst = dist(nd.est.q,r,g,b,a);  return nd;  }
		var pd = planeDst(nd.est,r,g,b,a);
		
		var node0 = nd.left, node1 = nd.right;
		if(pd>0) {  node0=nd.right;  node1=nd.left;  }
		
		var ln = getNearest(node0, r,g,b,a);
		if(ln.tdst<=pd*pd) return ln;
		var rn = getNearest(node1, r,g,b,a);
		return rn.tdst<ln.tdst ? rn : ln;
	}
	function planeDst(est, r,g,b,a) {  var e = est.e;  return e[0]*r + e[1]*g + e[2]*b + e[3]*a - est.eMq;  }
	function dist    (q,   r,g,b,a) {  var d0=r-q[0], d1=g-q[1], d2=b-q[2], d3=a-q[3];  return d0*d0+d1*d1+d2*d2+d3*d3;  }

	function splitPixels(nimg, nimg32, i0, i1, e, eMq)
	{
		i1-=4;
		var shfs = 0;
		while(i0<i1)
		{
			while(vecDot(nimg, i0, e)<=eMq) i0+=4;
			while(vecDot(nimg, i1, e)> eMq) i1-=4;
			if(i0>=i1) break;
			
			var t = nimg32[i0>>2];  nimg32[i0>>2] = nimg32[i1>>2];  nimg32[i1>>2]=t;
			
			i0+=4;  i1-=4;
		}
		while(vecDot(nimg, i0, e)>eMq) i0-=4;
		return i0+4;
	}
	function vecDot(nimg, i, e)
	{
		return nimg[i]*e[0] + nimg[i+1]*e[1] + nimg[i+2]*e[2] + nimg[i+3]*e[3];
	}
	function stats(nimg, i0, i1){
		var R = [0,0,0,0,  0,0,0,0,  0,0,0,0,  0,0,0,0];
		var m = [0,0,0,0];
		var N = (i1-i0)>>2;
		for(var i=i0; i<i1; i+=4)
		{
			var r = nimg[i]*(1/255), g = nimg[i+1]*(1/255), b = nimg[i+2]*(1/255), a = nimg[i+3]*(1/255);
			//var r = nimg[i], g = nimg[i+1], b = nimg[i+2], a = nimg[i+3];
			m[0]+=r;  m[1]+=g;  m[2]+=b;  m[3]+=a;
			
			R[ 0] += r*r;  R[ 1] += r*g;  R[ 2] += r*b;  R[ 3] += r*a;  
						   R[ 5] += g*g;  R[ 6] += g*b;  R[ 7] += g*a; 
										  R[10] += b*b;  R[11] += b*a;  
														 R[15] += a*a;  
		}
		R[4]=R[1];  R[8]=R[2];  R[9]=R[6];  R[12]=R[3];  R[13]=R[7];  R[14]=R[11];
		
		return {R:R, m:m, N:N};
	}
	function estats(stats){
		var R = stats.R, m = stats.m, N = stats.N;
		
		// when all samples are equal, but N is large (millions), the Rj can be non-zero ( 0.0003.... - precission error)
		var m0 = m[0], m1 = m[1], m2 = m[2], m3 = m[3], iN = (N==0 ? 0 : 1/N);
		var Rj = [
			R[ 0] - m0*m0*iN,  R[ 1] - m0*m1*iN,  R[ 2] - m0*m2*iN,  R[ 3] - m0*m3*iN,  
			R[ 4] - m1*m0*iN,  R[ 5] - m1*m1*iN,  R[ 6] - m1*m2*iN,  R[ 7] - m1*m3*iN,
			R[ 8] - m2*m0*iN,  R[ 9] - m2*m1*iN,  R[10] - m2*m2*iN,  R[11] - m2*m3*iN,  
			R[12] - m3*m0*iN,  R[13] - m3*m1*iN,  R[14] - m3*m2*iN,  R[15] - m3*m3*iN 
		];
		
		var A = Rj, M = M4;
		var b = [Math.random(),Math.random(),Math.random(),Math.random()], mi = 0, tmi = 0;
		
		if(N!=0)
		for(var i=0; i<16; i++) {
			b = M.multVec(A, b);  tmi = Math.sqrt(M.dot(b,b));  b = M.sml(1/tmi,  b);
			if(i!=0 && Math.abs(tmi-mi)<1e-9) break;  mi = tmi;
		}	
		//b = [0,0,1,0];  mi=N;
		var q = [m0*iN, m1*iN, m2*iN, m3*iN];
		var eMq255 = M.dot(M.sml(255,q),b);
		
		return {  Cov:Rj, q:q, e:b, L:mi,  eMq255:eMq255, eMq : M.dot(b,q),
					rgba: (((Math.round(255*q[3])<<24) | (Math.round(255*q[2])<<16) |  (Math.round(255*q[1])<<8) | (Math.round(255*q[0])<<0))>>>0)  };
	}
	var M4 = {
		multVec : function(m,v) {
				return [
					m[ 0]*v[0] + m[ 1]*v[1] + m[ 2]*v[2] + m[ 3]*v[3],
					m[ 4]*v[0] + m[ 5]*v[1] + m[ 6]*v[2] + m[ 7]*v[3],
					m[ 8]*v[0] + m[ 9]*v[1] + m[10]*v[2] + m[11]*v[3],
					m[12]*v[0] + m[13]*v[1] + m[14]*v[2] + m[15]*v[3]
				];
		},
		dot : function(x,y) {  return  x[0]*y[0]+x[1]*y[1]+x[2]*y[2]+x[3]*y[3];  },
		sml : function(a,y) {  return [a*y[0],a*y[1],a*y[2],a*y[3]];  }
	}

	function concatRGBA(bufs) {
		var tlen = 0;
		for(var i=0; i<bufs.length; i++) tlen += bufs[i].byteLength;
		var nimg = new Uint8Array(tlen), noff=0;
		for(var i=0; i<bufs.length; i++) {
			var img = new Uint8Array(bufs[i]), il = img.length;
			for(var j=0; j<il; j+=4) {  
				var r=img[j], g=img[j+1], b=img[j+2], a = img[j+3];
				if(a==0) r=g=b=0;
				nimg[noff+j]=r;  nimg[noff+j+1]=g;  nimg[noff+j+2]=b;  nimg[noff+j+3]=a;  }
			noff += il;
		}
		return nimg.buffer;
	}
	
	__UPNG__.encode = encode;
	__UPNG__.encodeLL = encodeLL;
	__UPNG__.encode.compress = compress;
	__UPNG__.encode.dither = dither;
	
	__UPNG__.quantize = quantize;
	__UPNG__.quantize.findNearest=findNearest;
	__UPNG__.quantize.getKDtree=getKDtree;
	__UPNG__.quantize.getNearest=getNearest;
})();


/**
 * PAKO
 * 
 * 
 * 
 * 
 */
/* pako 1.0.3 nodeca/pako */
!function(t){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=t();else if("function"==typeof define&&define.amd)define([],t);else{var e;e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof self?self:this,e.pako=t()}}(function(){return function t(e,a,i){function n(s,o){if(!a[s]){if(!e[s]){var l="function"==typeof require&&require;if(!o&&l)return l(s,!0);if(r)return r(s,!0);var h=new Error("Cannot find module '"+s+"'");throw h.code="MODULE_NOT_FOUND",h}var d=a[s]={exports:{}};e[s][0].call(d.exports,function(t){var a=e[s][1][t];return n(a?a:t)},d,d.exports,t,e,a,i)}return a[s].exports}for(var r="function"==typeof require&&require,s=0;s<i.length;s++)n(i[s]);return n}({1:[function(t,e,a){"use strict";function i(t){if(!(this instanceof i))return new i(t);this.options=l.assign({level:w,method:v,chunkSize:16384,windowBits:15,memLevel:8,strategy:p,to:""},t||{});var e=this.options;e.raw&&e.windowBits>0?e.windowBits=-e.windowBits:e.gzip&&e.windowBits>0&&e.windowBits<16&&(e.windowBits+=16),this.err=0,this.msg="",this.ended=!1,this.chunks=[],this.strm=new f,this.strm.avail_out=0;var a=o.deflateInit2(this.strm,e.level,e.method,e.windowBits,e.memLevel,e.strategy);if(a!==b)throw new Error(d[a]);if(e.header&&o.deflateSetHeader(this.strm,e.header),e.dictionary){var n;if(n="string"==typeof e.dictionary?h.string2buf(e.dictionary):"[object ArrayBuffer]"===_.call(e.dictionary)?new Uint8Array(e.dictionary):e.dictionary,a=o.deflateSetDictionary(this.strm,n),a!==b)throw new Error(d[a]);this._dict_set=!0}}function n(t,e){var a=new i(e);if(a.push(t,!0),a.err)throw a.msg;return a.result}function r(t,e){return e=e||{},e.raw=!0,n(t,e)}function s(t,e){return e=e||{},e.gzip=!0,n(t,e)}var o=t("./zlib/deflate"),l=t("./utils/common"),h=t("./utils/strings"),d=t("./zlib/messages"),f=t("./zlib/zstream"),_=Object.prototype.toString,u=0,c=4,b=0,g=1,m=2,w=-1,p=0,v=8;i.prototype.push=function(t,e){var a,i,n=this.strm,r=this.options.chunkSize;if(this.ended)return!1;i=e===~~e?e:e===!0?c:u,"string"==typeof t?n.input=h.string2buf(t):"[object ArrayBuffer]"===_.call(t)?n.input=new Uint8Array(t):n.input=t,n.next_in=0,n.avail_in=n.input.length;do{if(0===n.avail_out&&(n.output=new l.Buf8(r),n.next_out=0,n.avail_out=r),a=o.deflate(n,i),a!==g&&a!==b)return this.onEnd(a),this.ended=!0,!1;0!==n.avail_out&&(0!==n.avail_in||i!==c&&i!==m)||("string"===this.options.to?this.onData(h.buf2binstring(l.shrinkBuf(n.output,n.next_out))):this.onData(l.shrinkBuf(n.output,n.next_out)))}while((n.avail_in>0||0===n.avail_out)&&a!==g);return i===c?(a=o.deflateEnd(this.strm),this.onEnd(a),this.ended=!0,a===b):i!==m||(this.onEnd(b),n.avail_out=0,!0)},i.prototype.onData=function(t){this.chunks.push(t)},i.prototype.onEnd=function(t){t===b&&("string"===this.options.to?this.result=this.chunks.join(""):this.result=l.flattenChunks(this.chunks)),this.chunks=[],this.err=t,this.msg=this.strm.msg},a.Deflate=i,a.deflate=n,a.deflateRaw=r,a.gzip=s},{"./utils/common":3,"./utils/strings":4,"./zlib/deflate":8,"./zlib/messages":13,"./zlib/zstream":15}],2:[function(t,e,a){"use strict";function i(t){if(!(this instanceof i))return new i(t);this.options=o.assign({chunkSize:16384,windowBits:0,to:""},t||{});var e=this.options;e.raw&&e.windowBits>=0&&e.windowBits<16&&(e.windowBits=-e.windowBits,0===e.windowBits&&(e.windowBits=-15)),!(e.windowBits>=0&&e.windowBits<16)||t&&t.windowBits||(e.windowBits+=32),e.windowBits>15&&e.windowBits<48&&0===(15&e.windowBits)&&(e.windowBits|=15),this.err=0,this.msg="",this.ended=!1,this.chunks=[],this.strm=new f,this.strm.avail_out=0;var a=s.inflateInit2(this.strm,e.windowBits);if(a!==h.Z_OK)throw new Error(d[a]);this.header=new _,s.inflateGetHeader(this.strm,this.header)}function n(t,e){var a=new i(e);if(a.push(t,!0),a.err)throw a.msg;return a.result}function r(t,e){return e=e||{},e.raw=!0,n(t,e)}var s=t("./zlib/inflate"),o=t("./utils/common"),l=t("./utils/strings"),h=t("./zlib/constants"),d=t("./zlib/messages"),f=t("./zlib/zstream"),_=t("./zlib/gzheader"),u=Object.prototype.toString;i.prototype.push=function(t,e){var a,i,n,r,d,f,_=this.strm,c=this.options.chunkSize,b=this.options.dictionary,g=!1;if(this.ended)return!1;i=e===~~e?e:e===!0?h.Z_FINISH:h.Z_NO_FLUSH,"string"==typeof t?_.input=l.binstring2buf(t):"[object ArrayBuffer]"===u.call(t)?_.input=new Uint8Array(t):_.input=t,_.next_in=0,_.avail_in=_.input.length;do{if(0===_.avail_out&&(_.output=new o.Buf8(c),_.next_out=0,_.avail_out=c),a=s.inflate(_,h.Z_NO_FLUSH),a===h.Z_NEED_DICT&&b&&(f="string"==typeof b?l.string2buf(b):"[object ArrayBuffer]"===u.call(b)?new Uint8Array(b):b,a=s.inflateSetDictionary(this.strm,f)),a===h.Z_BUF_ERROR&&g===!0&&(a=h.Z_OK,g=!1),a!==h.Z_STREAM_END&&a!==h.Z_OK)return this.onEnd(a),this.ended=!0,!1;_.next_out&&(0!==_.avail_out&&a!==h.Z_STREAM_END&&(0!==_.avail_in||i!==h.Z_FINISH&&i!==h.Z_SYNC_FLUSH)||("string"===this.options.to?(n=l.utf8border(_.output,_.next_out),r=_.next_out-n,d=l.buf2string(_.output,n),_.next_out=r,_.avail_out=c-r,r&&o.arraySet(_.output,_.output,n,r,0),this.onData(d)):this.onData(o.shrinkBuf(_.output,_.next_out)))),0===_.avail_in&&0===_.avail_out&&(g=!0)}while((_.avail_in>0||0===_.avail_out)&&a!==h.Z_STREAM_END);return a===h.Z_STREAM_END&&(i=h.Z_FINISH),i===h.Z_FINISH?(a=s.inflateEnd(this.strm),this.onEnd(a),this.ended=!0,a===h.Z_OK):i!==h.Z_SYNC_FLUSH||(this.onEnd(h.Z_OK),_.avail_out=0,!0)},i.prototype.onData=function(t){this.chunks.push(t)},i.prototype.onEnd=function(t){t===h.Z_OK&&("string"===this.options.to?this.result=this.chunks.join(""):this.result=o.flattenChunks(this.chunks)),this.chunks=[],this.err=t,this.msg=this.strm.msg},a.Inflate=i,a.inflate=n,a.inflateRaw=r,a.ungzip=n},{"./utils/common":3,"./utils/strings":4,"./zlib/constants":6,"./zlib/gzheader":9,"./zlib/inflate":11,"./zlib/messages":13,"./zlib/zstream":15}],3:[function(t,e,a){"use strict";var i="undefined"!=typeof Uint8Array&&"undefined"!=typeof Uint16Array&&"undefined"!=typeof Int32Array;a.assign=function(t){for(var e=Array.prototype.slice.call(arguments,1);e.length;){var a=e.shift();if(a){if("object"!=typeof a)throw new TypeError(a+"must be non-object");for(var i in a)a.hasOwnProperty(i)&&(t[i]=a[i])}}return t},a.shrinkBuf=function(t,e){return t.length===e?t:t.subarray?t.subarray(0,e):(t.length=e,t)};var n={arraySet:function(t,e,a,i,n){if(e.subarray&&t.subarray)return void t.set(e.subarray(a,a+i),n);for(var r=0;r<i;r++)t[n+r]=e[a+r]},flattenChunks:function(t){var e,a,i,n,r,s;for(i=0,e=0,a=t.length;e<a;e++)i+=t[e].length;for(s=new Uint8Array(i),n=0,e=0,a=t.length;e<a;e++)r=t[e],s.set(r,n),n+=r.length;return s}},r={arraySet:function(t,e,a,i,n){for(var r=0;r<i;r++)t[n+r]=e[a+r]},flattenChunks:function(t){return[].concat.apply([],t)}};a.setTyped=function(t){t?(a.Buf8=Uint8Array,a.Buf16=Uint16Array,a.Buf32=Int32Array,a.assign(a,n)):(a.Buf8=Array,a.Buf16=Array,a.Buf32=Array,a.assign(a,r))},a.setTyped(i)},{}],4:[function(t,e,a){"use strict";function i(t,e){if(e<65537&&(t.subarray&&s||!t.subarray&&r))return String.fromCharCode.apply(null,n.shrinkBuf(t,e));for(var a="",i=0;i<e;i++)a+=String.fromCharCode(t[i]);return a}var n=t("./common"),r=!0,s=!0;try{String.fromCharCode.apply(null,[0])}catch(t){r=!1}try{String.fromCharCode.apply(null,new Uint8Array(1))}catch(t){s=!1}for(var o=new n.Buf8(256),l=0;l<256;l++)o[l]=l>=252?6:l>=248?5:l>=240?4:l>=224?3:l>=192?2:1;o[254]=o[254]=1,a.string2buf=function(t){var e,a,i,r,s,o=t.length,l=0;for(r=0;r<o;r++)a=t.charCodeAt(r),55296===(64512&a)&&r+1<o&&(i=t.charCodeAt(r+1),56320===(64512&i)&&(a=65536+(a-55296<<10)+(i-56320),r++)),l+=a<128?1:a<2048?2:a<65536?3:4;for(e=new n.Buf8(l),s=0,r=0;s<l;r++)a=t.charCodeAt(r),55296===(64512&a)&&r+1<o&&(i=t.charCodeAt(r+1),56320===(64512&i)&&(a=65536+(a-55296<<10)+(i-56320),r++)),a<128?e[s++]=a:a<2048?(e[s++]=192|a>>>6,e[s++]=128|63&a):a<65536?(e[s++]=224|a>>>12,e[s++]=128|a>>>6&63,e[s++]=128|63&a):(e[s++]=240|a>>>18,e[s++]=128|a>>>12&63,e[s++]=128|a>>>6&63,e[s++]=128|63&a);return e},a.buf2binstring=function(t){return i(t,t.length)},a.binstring2buf=function(t){for(var e=new n.Buf8(t.length),a=0,i=e.length;a<i;a++)e[a]=t.charCodeAt(a);return e},a.buf2string=function(t,e){var a,n,r,s,l=e||t.length,h=new Array(2*l);for(n=0,a=0;a<l;)if(r=t[a++],r<128)h[n++]=r;else if(s=o[r],s>4)h[n++]=65533,a+=s-1;else{for(r&=2===s?31:3===s?15:7;s>1&&a<l;)r=r<<6|63&t[a++],s--;s>1?h[n++]=65533:r<65536?h[n++]=r:(r-=65536,h[n++]=55296|r>>10&1023,h[n++]=56320|1023&r)}return i(h,n)},a.utf8border=function(t,e){var a;for(e=e||t.length,e>t.length&&(e=t.length),a=e-1;a>=0&&128===(192&t[a]);)a--;return a<0?e:0===a?e:a+o[t[a]]>e?a:e}},{"./common":3}],5:[function(t,e,a){"use strict";function i(t,e,a,i){for(var n=65535&t|0,r=t>>>16&65535|0,s=0;0!==a;){s=a>2e3?2e3:a,a-=s;do n=n+e[i++]|0,r=r+n|0;while(--s);n%=65521,r%=65521}return n|r<<16|0}e.exports=i},{}],6:[function(t,e,a){"use strict";e.exports={Z_NO_FLUSH:0,Z_PARTIAL_FLUSH:1,Z_SYNC_FLUSH:2,Z_FULL_FLUSH:3,Z_FINISH:4,Z_BLOCK:5,Z_TREES:6,Z_OK:0,Z_STREAM_END:1,Z_NEED_DICT:2,Z_ERRNO:-1,Z_STREAM_ERROR:-2,Z_DATA_ERROR:-3,Z_BUF_ERROR:-5,Z_NO_COMPRESSION:0,Z_BEST_SPEED:1,Z_BEST_COMPRESSION:9,Z_DEFAULT_COMPRESSION:-1,Z_FILTERED:1,Z_HUFFMAN_ONLY:2,Z_RLE:3,Z_FIXED:4,Z_DEFAULT_STRATEGY:0,Z_BINARY:0,Z_TEXT:1,Z_UNKNOWN:2,Z_DEFLATED:8}},{}],7:[function(t,e,a){"use strict";function i(){for(var t,e=[],a=0;a<256;a++){t=a;for(var i=0;i<8;i++)t=1&t?3988292384^t>>>1:t>>>1;e[a]=t}return e}function n(t,e,a,i){var n=r,s=i+a;t^=-1;for(var o=i;o<s;o++)t=t>>>8^n[255&(t^e[o])];return t^-1}var r=i();e.exports=n},{}],8:[function(t,e,a){"use strict";function i(t,e){return t.msg=D[e],e}function n(t){return(t<<1)-(t>4?9:0)}function r(t){for(var e=t.length;--e>=0;)t[e]=0}function s(t){var e=t.state,a=e.pending;a>t.avail_out&&(a=t.avail_out),0!==a&&(R.arraySet(t.output,e.pending_buf,e.pending_out,a,t.next_out),t.next_out+=a,e.pending_out+=a,t.total_out+=a,t.avail_out-=a,e.pending-=a,0===e.pending&&(e.pending_out=0))}function o(t,e){C._tr_flush_block(t,t.block_start>=0?t.block_start:-1,t.strstart-t.block_start,e),t.block_start=t.strstart,s(t.strm)}function l(t,e){t.pending_buf[t.pending++]=e}function h(t,e){t.pending_buf[t.pending++]=e>>>8&255,t.pending_buf[t.pending++]=255&e}function d(t,e,a,i){var n=t.avail_in;return n>i&&(n=i),0===n?0:(t.avail_in-=n,R.arraySet(e,t.input,t.next_in,n,a),1===t.state.wrap?t.adler=N(t.adler,e,n,a):2===t.state.wrap&&(t.adler=O(t.adler,e,n,a)),t.next_in+=n,t.total_in+=n,n)}function f(t,e){var a,i,n=t.max_chain_length,r=t.strstart,s=t.prev_length,o=t.nice_match,l=t.strstart>t.w_size-ft?t.strstart-(t.w_size-ft):0,h=t.window,d=t.w_mask,f=t.prev,_=t.strstart+dt,u=h[r+s-1],c=h[r+s];t.prev_length>=t.good_match&&(n>>=2),o>t.lookahead&&(o=t.lookahead);do if(a=e,h[a+s]===c&&h[a+s-1]===u&&h[a]===h[r]&&h[++a]===h[r+1]){r+=2,a++;do;while(h[++r]===h[++a]&&h[++r]===h[++a]&&h[++r]===h[++a]&&h[++r]===h[++a]&&h[++r]===h[++a]&&h[++r]===h[++a]&&h[++r]===h[++a]&&h[++r]===h[++a]&&r<_);if(i=dt-(_-r),r=_-dt,i>s){if(t.match_start=e,s=i,i>=o)break;u=h[r+s-1],c=h[r+s]}}while((e=f[e&d])>l&&0!==--n);return s<=t.lookahead?s:t.lookahead}function _(t){var e,a,i,n,r,s=t.w_size;do{if(n=t.window_size-t.lookahead-t.strstart,t.strstart>=s+(s-ft)){R.arraySet(t.window,t.window,s,s,0),t.match_start-=s,t.strstart-=s,t.block_start-=s,a=t.hash_size,e=a;do i=t.head[--e],t.head[e]=i>=s?i-s:0;while(--a);a=s,e=a;do i=t.prev[--e],t.prev[e]=i>=s?i-s:0;while(--a);n+=s}if(0===t.strm.avail_in)break;if(a=d(t.strm,t.window,t.strstart+t.lookahead,n),t.lookahead+=a,t.lookahead+t.insert>=ht)for(r=t.strstart-t.insert,t.ins_h=t.window[r],t.ins_h=(t.ins_h<<t.hash_shift^t.window[r+1])&t.hash_mask;t.insert&&(t.ins_h=(t.ins_h<<t.hash_shift^t.window[r+ht-1])&t.hash_mask,t.prev[r&t.w_mask]=t.head[t.ins_h],t.head[t.ins_h]=r,r++,t.insert--,!(t.lookahead+t.insert<ht)););}while(t.lookahead<ft&&0!==t.strm.avail_in)}function u(t,e){var a=65535;for(a>t.pending_buf_size-5&&(a=t.pending_buf_size-5);;){if(t.lookahead<=1){if(_(t),0===t.lookahead&&e===I)return vt;if(0===t.lookahead)break}t.strstart+=t.lookahead,t.lookahead=0;var i=t.block_start+a;if((0===t.strstart||t.strstart>=i)&&(t.lookahead=t.strstart-i,t.strstart=i,o(t,!1),0===t.strm.avail_out))return vt;if(t.strstart-t.block_start>=t.w_size-ft&&(o(t,!1),0===t.strm.avail_out))return vt}return t.insert=0,e===F?(o(t,!0),0===t.strm.avail_out?yt:xt):t.strstart>t.block_start&&(o(t,!1),0===t.strm.avail_out)?vt:vt}function c(t,e){for(var a,i;;){if(t.lookahead<ft){if(_(t),t.lookahead<ft&&e===I)return vt;if(0===t.lookahead)break}if(a=0,t.lookahead>=ht&&(t.ins_h=(t.ins_h<<t.hash_shift^t.window[t.strstart+ht-1])&t.hash_mask,a=t.prev[t.strstart&t.w_mask]=t.head[t.ins_h],t.head[t.ins_h]=t.strstart),0!==a&&t.strstart-a<=t.w_size-ft&&(t.match_length=f(t,a)),t.match_length>=ht)if(i=C._tr_tally(t,t.strstart-t.match_start,t.match_length-ht),t.lookahead-=t.match_length,t.match_length<=t.max_lazy_match&&t.lookahead>=ht){t.match_length--;do t.strstart++,t.ins_h=(t.ins_h<<t.hash_shift^t.window[t.strstart+ht-1])&t.hash_mask,a=t.prev[t.strstart&t.w_mask]=t.head[t.ins_h],t.head[t.ins_h]=t.strstart;while(0!==--t.match_length);t.strstart++}else t.strstart+=t.match_length,t.match_length=0,t.ins_h=t.window[t.strstart],t.ins_h=(t.ins_h<<t.hash_shift^t.window[t.strstart+1])&t.hash_mask;else i=C._tr_tally(t,0,t.window[t.strstart]),t.lookahead--,t.strstart++;if(i&&(o(t,!1),0===t.strm.avail_out))return vt}return t.insert=t.strstart<ht-1?t.strstart:ht-1,e===F?(o(t,!0),0===t.strm.avail_out?yt:xt):t.last_lit&&(o(t,!1),0===t.strm.avail_out)?vt:kt}function b(t,e){for(var a,i,n;;){if(t.lookahead<ft){if(_(t),t.lookahead<ft&&e===I)return vt;if(0===t.lookahead)break}if(a=0,t.lookahead>=ht&&(t.ins_h=(t.ins_h<<t.hash_shift^t.window[t.strstart+ht-1])&t.hash_mask,a=t.prev[t.strstart&t.w_mask]=t.head[t.ins_h],t.head[t.ins_h]=t.strstart),t.prev_length=t.match_length,t.prev_match=t.match_start,t.match_length=ht-1,0!==a&&t.prev_length<t.max_lazy_match&&t.strstart-a<=t.w_size-ft&&(t.match_length=f(t,a),t.match_length<=5&&(t.strategy===q||t.match_length===ht&&t.strstart-t.match_start>4096)&&(t.match_length=ht-1)),t.prev_length>=ht&&t.match_length<=t.prev_length){n=t.strstart+t.lookahead-ht,i=C._tr_tally(t,t.strstart-1-t.prev_match,t.prev_length-ht),t.lookahead-=t.prev_length-1,t.prev_length-=2;do++t.strstart<=n&&(t.ins_h=(t.ins_h<<t.hash_shift^t.window[t.strstart+ht-1])&t.hash_mask,a=t.prev[t.strstart&t.w_mask]=t.head[t.ins_h],t.head[t.ins_h]=t.strstart);while(0!==--t.prev_length);if(t.match_available=0,t.match_length=ht-1,t.strstart++,i&&(o(t,!1),0===t.strm.avail_out))return vt}else if(t.match_available){if(i=C._tr_tally(t,0,t.window[t.strstart-1]),i&&o(t,!1),t.strstart++,t.lookahead--,0===t.strm.avail_out)return vt}else t.match_available=1,t.strstart++,t.lookahead--}return t.match_available&&(i=C._tr_tally(t,0,t.window[t.strstart-1]),t.match_available=0),t.insert=t.strstart<ht-1?t.strstart:ht-1,e===F?(o(t,!0),0===t.strm.avail_out?yt:xt):t.last_lit&&(o(t,!1),0===t.strm.avail_out)?vt:kt}function g(t,e){for(var a,i,n,r,s=t.window;;){if(t.lookahead<=dt){if(_(t),t.lookahead<=dt&&e===I)return vt;if(0===t.lookahead)break}if(t.match_length=0,t.lookahead>=ht&&t.strstart>0&&(n=t.strstart-1,i=s[n],i===s[++n]&&i===s[++n]&&i===s[++n])){r=t.strstart+dt;do;while(i===s[++n]&&i===s[++n]&&i===s[++n]&&i===s[++n]&&i===s[++n]&&i===s[++n]&&i===s[++n]&&i===s[++n]&&n<r);t.match_length=dt-(r-n),t.match_length>t.lookahead&&(t.match_length=t.lookahead)}if(t.match_length>=ht?(a=C._tr_tally(t,1,t.match_length-ht),t.lookahead-=t.match_length,t.strstart+=t.match_length,t.match_length=0):(a=C._tr_tally(t,0,t.window[t.strstart]),t.lookahead--,t.strstart++),a&&(o(t,!1),0===t.strm.avail_out))return vt}return t.insert=0,e===F?(o(t,!0),0===t.strm.avail_out?yt:xt):t.last_lit&&(o(t,!1),0===t.strm.avail_out)?vt:kt}function m(t,e){for(var a;;){if(0===t.lookahead&&(_(t),0===t.lookahead)){if(e===I)return vt;break}if(t.match_length=0,a=C._tr_tally(t,0,t.window[t.strstart]),t.lookahead--,t.strstart++,a&&(o(t,!1),0===t.strm.avail_out))return vt}return t.insert=0,e===F?(o(t,!0),0===t.strm.avail_out?yt:xt):t.last_lit&&(o(t,!1),0===t.strm.avail_out)?vt:kt}function w(t,e,a,i,n){this.good_length=t,this.max_lazy=e,this.nice_length=a,this.max_chain=i,this.func=n}function p(t){t.window_size=2*t.w_size,r(t.head),t.max_lazy_match=Z[t.level].max_lazy,t.good_match=Z[t.level].good_length,t.nice_match=Z[t.level].nice_length,t.max_chain_length=Z[t.level].max_chain,t.strstart=0,t.block_start=0,t.lookahead=0,t.insert=0,t.match_length=t.prev_length=ht-1,t.match_available=0,t.ins_h=0}function v(){this.strm=null,this.status=0,this.pending_buf=null,this.pending_buf_size=0,this.pending_out=0,this.pending=0,this.wrap=0,this.gzhead=null,this.gzindex=0,this.method=V,this.last_flush=-1,this.w_size=0,this.w_bits=0,this.w_mask=0,this.window=null,this.window_size=0,this.prev=null,this.head=null,this.ins_h=0,this.hash_size=0,this.hash_bits=0,this.hash_mask=0,this.hash_shift=0,this.block_start=0,this.match_length=0,this.prev_match=0,this.match_available=0,this.strstart=0,this.match_start=0,this.lookahead=0,this.prev_length=0,this.max_chain_length=0,this.max_lazy_match=0,this.level=0,this.strategy=0,this.good_match=0,this.nice_match=0,this.dyn_ltree=new R.Buf16(2*ot),this.dyn_dtree=new R.Buf16(2*(2*rt+1)),this.bl_tree=new R.Buf16(2*(2*st+1)),r(this.dyn_ltree),r(this.dyn_dtree),r(this.bl_tree),this.l_desc=null,this.d_desc=null,this.bl_desc=null,this.bl_count=new R.Buf16(lt+1),this.heap=new R.Buf16(2*nt+1),r(this.heap),this.heap_len=0,this.heap_max=0,this.depth=new R.Buf16(2*nt+1),r(this.depth),this.l_buf=0,this.lit_bufsize=0,this.last_lit=0,this.d_buf=0,this.opt_len=0,this.static_len=0,this.matches=0,this.insert=0,this.bi_buf=0,this.bi_valid=0}function k(t){var e;return t&&t.state?(t.total_in=t.total_out=0,t.data_type=Q,e=t.state,e.pending=0,e.pending_out=0,e.wrap<0&&(e.wrap=-e.wrap),e.status=e.wrap?ut:wt,t.adler=2===e.wrap?0:1,e.last_flush=I,C._tr_init(e),H):i(t,K)}function y(t){var e=k(t);return e===H&&p(t.state),e}function x(t,e){return t&&t.state?2!==t.state.wrap?K:(t.state.gzhead=e,H):K}function z(t,e,a,n,r,s){if(!t)return K;var o=1;if(e===Y&&(e=6),n<0?(o=0,n=-n):n>15&&(o=2,n-=16),r<1||r>$||a!==V||n<8||n>15||e<0||e>9||s<0||s>W)return i(t,K);8===n&&(n=9);var l=new v;return t.state=l,l.strm=t,l.wrap=o,l.gzhead=null,l.w_bits=n,l.w_size=1<<l.w_bits,l.w_mask=l.w_size-1,l.hash_bits=r+7,l.hash_size=1<<l.hash_bits,l.hash_mask=l.hash_size-1,l.hash_shift=~~((l.hash_bits+ht-1)/ht),l.window=new R.Buf8(2*l.w_size),l.head=new R.Buf16(l.hash_size),l.prev=new R.Buf16(l.w_size),l.lit_bufsize=1<<r+6,l.pending_buf_size=4*l.lit_bufsize,l.pending_buf=new R.Buf8(l.pending_buf_size),l.d_buf=1*l.lit_bufsize,l.l_buf=3*l.lit_bufsize,l.level=e,l.strategy=s,l.method=a,y(t)}function B(t,e){return z(t,e,V,tt,et,J)}function S(t,e){var a,o,d,f;if(!t||!t.state||e>L||e<0)return t?i(t,K):K;if(o=t.state,!t.output||!t.input&&0!==t.avail_in||o.status===pt&&e!==F)return i(t,0===t.avail_out?P:K);if(o.strm=t,a=o.last_flush,o.last_flush=e,o.status===ut)if(2===o.wrap)t.adler=0,l(o,31),l(o,139),l(o,8),o.gzhead?(l(o,(o.gzhead.text?1:0)+(o.gzhead.hcrc?2:0)+(o.gzhead.extra?4:0)+(o.gzhead.name?8:0)+(o.gzhead.comment?16:0)),l(o,255&o.gzhead.time),l(o,o.gzhead.time>>8&255),l(o,o.gzhead.time>>16&255),l(o,o.gzhead.time>>24&255),l(o,9===o.level?2:o.strategy>=G||o.level<2?4:0),l(o,255&o.gzhead.os),o.gzhead.extra&&o.gzhead.extra.length&&(l(o,255&o.gzhead.extra.length),l(o,o.gzhead.extra.length>>8&255)),o.gzhead.hcrc&&(t.adler=O(t.adler,o.pending_buf,o.pending,0)),o.gzindex=0,o.status=ct):(l(o,0),l(o,0),l(o,0),l(o,0),l(o,0),l(o,9===o.level?2:o.strategy>=G||o.level<2?4:0),l(o,zt),o.status=wt);else{var _=V+(o.w_bits-8<<4)<<8,u=-1;u=o.strategy>=G||o.level<2?0:o.level<6?1:6===o.level?2:3,_|=u<<6,0!==o.strstart&&(_|=_t),_+=31-_%31,o.status=wt,h(o,_),0!==o.strstart&&(h(o,t.adler>>>16),h(o,65535&t.adler)),t.adler=1}if(o.status===ct)if(o.gzhead.extra){for(d=o.pending;o.gzindex<(65535&o.gzhead.extra.length)&&(o.pending!==o.pending_buf_size||(o.gzhead.hcrc&&o.pending>d&&(t.adler=O(t.adler,o.pending_buf,o.pending-d,d)),s(t),d=o.pending,o.pending!==o.pending_buf_size));)l(o,255&o.gzhead.extra[o.gzindex]),o.gzindex++;o.gzhead.hcrc&&o.pending>d&&(t.adler=O(t.adler,o.pending_buf,o.pending-d,d)),o.gzindex===o.gzhead.extra.length&&(o.gzindex=0,o.status=bt)}else o.status=bt;if(o.status===bt)if(o.gzhead.name){d=o.pending;do{if(o.pending===o.pending_buf_size&&(o.gzhead.hcrc&&o.pending>d&&(t.adler=O(t.adler,o.pending_buf,o.pending-d,d)),s(t),d=o.pending,o.pending===o.pending_buf_size)){f=1;break}f=o.gzindex<o.gzhead.name.length?255&o.gzhead.name.charCodeAt(o.gzindex++):0,l(o,f)}while(0!==f);o.gzhead.hcrc&&o.pending>d&&(t.adler=O(t.adler,o.pending_buf,o.pending-d,d)),0===f&&(o.gzindex=0,o.status=gt)}else o.status=gt;if(o.status===gt)if(o.gzhead.comment){d=o.pending;do{if(o.pending===o.pending_buf_size&&(o.gzhead.hcrc&&o.pending>d&&(t.adler=O(t.adler,o.pending_buf,o.pending-d,d)),s(t),d=o.pending,o.pending===o.pending_buf_size)){f=1;break}f=o.gzindex<o.gzhead.comment.length?255&o.gzhead.comment.charCodeAt(o.gzindex++):0,l(o,f)}while(0!==f);o.gzhead.hcrc&&o.pending>d&&(t.adler=O(t.adler,o.pending_buf,o.pending-d,d)),0===f&&(o.status=mt)}else o.status=mt;if(o.status===mt&&(o.gzhead.hcrc?(o.pending+2>o.pending_buf_size&&s(t),o.pending+2<=o.pending_buf_size&&(l(o,255&t.adler),l(o,t.adler>>8&255),t.adler=0,o.status=wt)):o.status=wt),0!==o.pending){if(s(t),0===t.avail_out)return o.last_flush=-1,H}else if(0===t.avail_in&&n(e)<=n(a)&&e!==F)return i(t,P);if(o.status===pt&&0!==t.avail_in)return i(t,P);if(0!==t.avail_in||0!==o.lookahead||e!==I&&o.status!==pt){var c=o.strategy===G?m(o,e):o.strategy===X?g(o,e):Z[o.level].func(o,e);if(c!==yt&&c!==xt||(o.status=pt),c===vt||c===yt)return 0===t.avail_out&&(o.last_flush=-1),H;if(c===kt&&(e===U?C._tr_align(o):e!==L&&(C._tr_stored_block(o,0,0,!1),e===T&&(r(o.head),0===o.lookahead&&(o.strstart=0,o.block_start=0,o.insert=0))),s(t),0===t.avail_out))return o.last_flush=-1,H}return e!==F?H:o.wrap<=0?j:(2===o.wrap?(l(o,255&t.adler),l(o,t.adler>>8&255),l(o,t.adler>>16&255),l(o,t.adler>>24&255),l(o,255&t.total_in),l(o,t.total_in>>8&255),l(o,t.total_in>>16&255),l(o,t.total_in>>24&255)):(h(o,t.adler>>>16),h(o,65535&t.adler)),s(t),o.wrap>0&&(o.wrap=-o.wrap),0!==o.pending?H:j)}function E(t){var e;return t&&t.state?(e=t.state.status,e!==ut&&e!==ct&&e!==bt&&e!==gt&&e!==mt&&e!==wt&&e!==pt?i(t,K):(t.state=null,e===wt?i(t,M):H)):K}function A(t,e){var a,i,n,s,o,l,h,d,f=e.length;if(!t||!t.state)return K;if(a=t.state,s=a.wrap,2===s||1===s&&a.status!==ut||a.lookahead)return K;for(1===s&&(t.adler=N(t.adler,e,f,0)),a.wrap=0,f>=a.w_size&&(0===s&&(r(a.head),a.strstart=0,a.block_start=0,a.insert=0),d=new R.Buf8(a.w_size),R.arraySet(d,e,f-a.w_size,a.w_size,0),e=d,f=a.w_size),o=t.avail_in,l=t.next_in,h=t.input,t.avail_in=f,t.next_in=0,t.input=e,_(a);a.lookahead>=ht;){i=a.strstart,n=a.lookahead-(ht-1);do a.ins_h=(a.ins_h<<a.hash_shift^a.window[i+ht-1])&a.hash_mask,a.prev[i&a.w_mask]=a.head[a.ins_h],a.head[a.ins_h]=i,i++;while(--n);a.strstart=i,a.lookahead=ht-1,_(a)}return a.strstart+=a.lookahead,a.block_start=a.strstart,a.insert=a.lookahead,a.lookahead=0,a.match_length=a.prev_length=ht-1,a.match_available=0,t.next_in=l,t.input=h,t.avail_in=o,a.wrap=s,H}var Z,R=t("../utils/common"),C=t("./trees"),N=t("./adler32"),O=t("./crc32"),D=t("./messages"),I=0,U=1,T=3,F=4,L=5,H=0,j=1,K=-2,M=-3,P=-5,Y=-1,q=1,G=2,X=3,W=4,J=0,Q=2,V=8,$=9,tt=15,et=8,at=29,it=256,nt=it+1+at,rt=30,st=19,ot=2*nt+1,lt=15,ht=3,dt=258,ft=dt+ht+1,_t=32,ut=42,ct=69,bt=73,gt=91,mt=103,wt=113,pt=666,vt=1,kt=2,yt=3,xt=4,zt=3;Z=[new w(0,0,0,0,u),new w(4,4,8,4,c),new w(4,5,16,8,c),new w(4,6,32,32,c),new w(4,4,16,16,b),new w(8,16,32,32,b),new w(8,16,128,128,b),new w(8,32,128,256,b),new w(32,128,258,1024,b),new w(32,258,258,4096,b)],a.deflateInit=B,a.deflateInit2=z,a.deflateReset=y,a.deflateResetKeep=k,a.deflateSetHeader=x,a.deflate=S,a.deflateEnd=E,a.deflateSetDictionary=A,a.deflateInfo="pako deflate (from Nodeca project)"},{"../utils/common":3,"./adler32":5,"./crc32":7,"./messages":13,"./trees":14}],9:[function(t,e,a){"use strict";function i(){this.text=0,this.time=0,this.xflags=0,this.os=0,this.extra=null,this.extra_len=0,this.name="",this.comment="",this.hcrc=0,this.done=!1}e.exports=i},{}],10:[function(t,e,a){"use strict";var i=30,n=12;e.exports=function(t,e){var a,r,s,o,l,h,d,f,_,u,c,b,g,m,w,p,v,k,y,x,z,B,S,E,A;a=t.state,r=t.next_in,E=t.input,s=r+(t.avail_in-5),o=t.next_out,A=t.output,l=o-(e-t.avail_out),h=o+(t.avail_out-257),d=a.dmax,f=a.wsize,_=a.whave,u=a.wnext,c=a.window,b=a.hold,g=a.bits,m=a.lencode,w=a.distcode,p=(1<<a.lenbits)-1,v=(1<<a.distbits)-1;t:do{g<15&&(b+=E[r++]<<g,g+=8,b+=E[r++]<<g,g+=8),k=m[b&p];e:for(;;){if(y=k>>>24,b>>>=y,g-=y,y=k>>>16&255,0===y)A[o++]=65535&k;else{if(!(16&y)){if(0===(64&y)){k=m[(65535&k)+(b&(1<<y)-1)];continue e}if(32&y){a.mode=n;break t}t.msg="invalid literal/length code",a.mode=i;break t}x=65535&k,y&=15,y&&(g<y&&(b+=E[r++]<<g,g+=8),x+=b&(1<<y)-1,b>>>=y,g-=y),g<15&&(b+=E[r++]<<g,g+=8,b+=E[r++]<<g,g+=8),k=w[b&v];a:for(;;){if(y=k>>>24,b>>>=y,g-=y,y=k>>>16&255,!(16&y)){if(0===(64&y)){k=w[(65535&k)+(b&(1<<y)-1)];continue a}t.msg="invalid distance code",a.mode=i;break t}if(z=65535&k,y&=15,g<y&&(b+=E[r++]<<g,g+=8,g<y&&(b+=E[r++]<<g,g+=8)),z+=b&(1<<y)-1,z>d){t.msg="invalid distance too far back",a.mode=i;break t}if(b>>>=y,g-=y,y=o-l,z>y){if(y=z-y,y>_&&a.sane){t.msg="invalid distance too far back",a.mode=i;break t}if(B=0,S=c,0===u){if(B+=f-y,y<x){x-=y;do A[o++]=c[B++];while(--y);B=o-z,S=A}}else if(u<y){if(B+=f+u-y,y-=u,y<x){x-=y;do A[o++]=c[B++];while(--y);if(B=0,u<x){y=u,x-=y;do A[o++]=c[B++];while(--y);B=o-z,S=A}}}else if(B+=u-y,y<x){x-=y;do A[o++]=c[B++];while(--y);B=o-z,S=A}for(;x>2;)A[o++]=S[B++],A[o++]=S[B++],A[o++]=S[B++],x-=3;x&&(A[o++]=S[B++],x>1&&(A[o++]=S[B++]))}else{B=o-z;do A[o++]=A[B++],A[o++]=A[B++],A[o++]=A[B++],x-=3;while(x>2);x&&(A[o++]=A[B++],x>1&&(A[o++]=A[B++]))}break}}break}}while(r<s&&o<h);x=g>>3,r-=x,g-=x<<3,b&=(1<<g)-1,t.next_in=r,t.next_out=o,t.avail_in=r<s?5+(s-r):5-(r-s),t.avail_out=o<h?257+(h-o):257-(o-h),a.hold=b,a.bits=g}},{}],11:[function(t,e,a){"use strict";function i(t){return(t>>>24&255)+(t>>>8&65280)+((65280&t)<<8)+((255&t)<<24)}function n(){this.mode=0,this.last=!1,this.wrap=0,this.havedict=!1,this.flags=0,this.dmax=0,this.check=0,this.total=0,this.head=null,this.wbits=0,this.wsize=0,this.whave=0,this.wnext=0,this.window=null,this.hold=0,this.bits=0,this.length=0,this.offset=0,this.extra=0,this.lencode=null,this.distcode=null,this.lenbits=0,this.distbits=0,this.ncode=0,this.nlen=0,this.ndist=0,this.have=0,this.next=null,this.lens=new w.Buf16(320),this.work=new w.Buf16(288),this.lendyn=null,this.distdyn=null,this.sane=0,this.back=0,this.was=0}function r(t){var e;return t&&t.state?(e=t.state,t.total_in=t.total_out=e.total=0,t.msg="",e.wrap&&(t.adler=1&e.wrap),e.mode=T,e.last=0,e.havedict=0,e.dmax=32768,e.head=null,e.hold=0,e.bits=0,e.lencode=e.lendyn=new w.Buf32(bt),e.distcode=e.distdyn=new w.Buf32(gt),e.sane=1,e.back=-1,Z):N}function s(t){var e;return t&&t.state?(e=t.state,e.wsize=0,e.whave=0,e.wnext=0,r(t)):N}function o(t,e){var a,i;return t&&t.state?(i=t.state,e<0?(a=0,e=-e):(a=(e>>4)+1,e<48&&(e&=15)),e&&(e<8||e>15)?N:(null!==i.window&&i.wbits!==e&&(i.window=null),i.wrap=a,i.wbits=e,s(t))):N}function l(t,e){var a,i;return t?(i=new n,t.state=i,i.window=null,a=o(t,e),a!==Z&&(t.state=null),a):N}function h(t){return l(t,wt)}function d(t){if(pt){var e;for(g=new w.Buf32(512),m=new w.Buf32(32),e=0;e<144;)t.lens[e++]=8;for(;e<256;)t.lens[e++]=9;for(;e<280;)t.lens[e++]=7;for(;e<288;)t.lens[e++]=8;for(y(z,t.lens,0,288,g,0,t.work,{bits:9}),e=0;e<32;)t.lens[e++]=5;y(B,t.lens,0,32,m,0,t.work,{bits:5}),pt=!1}t.lencode=g,t.lenbits=9,t.distcode=m,t.distbits=5}function f(t,e,a,i){var n,r=t.state;return null===r.window&&(r.wsize=1<<r.wbits,r.wnext=0,r.whave=0,r.window=new w.Buf8(r.wsize)),i>=r.wsize?(w.arraySet(r.window,e,a-r.wsize,r.wsize,0),r.wnext=0,r.whave=r.wsize):(n=r.wsize-r.wnext,n>i&&(n=i),w.arraySet(r.window,e,a-i,n,r.wnext),i-=n,i?(w.arraySet(r.window,e,a-i,i,0),r.wnext=i,r.whave=r.wsize):(r.wnext+=n,r.wnext===r.wsize&&(r.wnext=0),r.whave<r.wsize&&(r.whave+=n))),0}function _(t,e){var a,n,r,s,o,l,h,_,u,c,b,g,m,bt,gt,mt,wt,pt,vt,kt,yt,xt,zt,Bt,St=0,Et=new w.Buf8(4),At=[16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15];if(!t||!t.state||!t.output||!t.input&&0!==t.avail_in)return N;a=t.state,a.mode===X&&(a.mode=W),o=t.next_out,r=t.output,h=t.avail_out,s=t.next_in,n=t.input,l=t.avail_in,_=a.hold,u=a.bits,c=l,b=h,xt=Z;t:for(;;)switch(a.mode){case T:if(0===a.wrap){a.mode=W;break}for(;u<16;){if(0===l)break t;l--,_+=n[s++]<<u,u+=8}if(2&a.wrap&&35615===_){a.check=0,Et[0]=255&_,Et[1]=_>>>8&255,a.check=v(a.check,Et,2,0),_=0,u=0,a.mode=F;break}if(a.flags=0,a.head&&(a.head.done=!1),!(1&a.wrap)||(((255&_)<<8)+(_>>8))%31){t.msg="incorrect header check",a.mode=_t;break}if((15&_)!==U){t.msg="unknown compression method",a.mode=_t;break}if(_>>>=4,u-=4,yt=(15&_)+8,0===a.wbits)a.wbits=yt;else if(yt>a.wbits){t.msg="invalid window size",a.mode=_t;break}a.dmax=1<<yt,t.adler=a.check=1,a.mode=512&_?q:X,_=0,u=0;break;case F:for(;u<16;){if(0===l)break t;l--,_+=n[s++]<<u,u+=8}if(a.flags=_,(255&a.flags)!==U){t.msg="unknown compression method",a.mode=_t;break}if(57344&a.flags){t.msg="unknown header flags set",a.mode=_t;break}a.head&&(a.head.text=_>>8&1),512&a.flags&&(Et[0]=255&_,Et[1]=_>>>8&255,a.check=v(a.check,Et,2,0)),_=0,u=0,a.mode=L;case L:for(;u<32;){if(0===l)break t;l--,_+=n[s++]<<u,u+=8}a.head&&(a.head.time=_),512&a.flags&&(Et[0]=255&_,Et[1]=_>>>8&255,Et[2]=_>>>16&255,Et[3]=_>>>24&255,a.check=v(a.check,Et,4,0)),_=0,u=0,a.mode=H;case H:for(;u<16;){if(0===l)break t;l--,_+=n[s++]<<u,u+=8}a.head&&(a.head.xflags=255&_,a.head.os=_>>8),512&a.flags&&(Et[0]=255&_,Et[1]=_>>>8&255,a.check=v(a.check,Et,2,0)),_=0,u=0,a.mode=j;case j:if(1024&a.flags){for(;u<16;){if(0===l)break t;l--,_+=n[s++]<<u,u+=8}a.length=_,a.head&&(a.head.extra_len=_),512&a.flags&&(Et[0]=255&_,Et[1]=_>>>8&255,a.check=v(a.check,Et,2,0)),_=0,u=0}else a.head&&(a.head.extra=null);a.mode=K;case K:if(1024&a.flags&&(g=a.length,g>l&&(g=l),g&&(a.head&&(yt=a.head.extra_len-a.length,a.head.extra||(a.head.extra=new Array(a.head.extra_len)),w.arraySet(a.head.extra,n,s,g,yt)),512&a.flags&&(a.check=v(a.check,n,g,s)),l-=g,s+=g,a.length-=g),a.length))break t;a.length=0,a.mode=M;case M:if(2048&a.flags){if(0===l)break t;g=0;do yt=n[s+g++],a.head&&yt&&a.length<65536&&(a.head.name+=String.fromCharCode(yt));while(yt&&g<l);if(512&a.flags&&(a.check=v(a.check,n,g,s)),l-=g,s+=g,yt)break t}else a.head&&(a.head.name=null);a.length=0,a.mode=P;case P:if(4096&a.flags){if(0===l)break t;g=0;do yt=n[s+g++],a.head&&yt&&a.length<65536&&(a.head.comment+=String.fromCharCode(yt));while(yt&&g<l);if(512&a.flags&&(a.check=v(a.check,n,g,s)),l-=g,s+=g,yt)break t}else a.head&&(a.head.comment=null);a.mode=Y;case Y:if(512&a.flags){for(;u<16;){if(0===l)break t;l--,_+=n[s++]<<u,u+=8}if(_!==(65535&a.check)){t.msg="header crc mismatch",a.mode=_t;break}_=0,u=0}a.head&&(a.head.hcrc=a.flags>>9&1,a.head.done=!0),t.adler=a.check=0,a.mode=X;break;case q:for(;u<32;){if(0===l)break t;l--,_+=n[s++]<<u,u+=8}t.adler=a.check=i(_),_=0,u=0,a.mode=G;case G:if(0===a.havedict)return t.next_out=o,t.avail_out=h,t.next_in=s,t.avail_in=l,a.hold=_,a.bits=u,C;t.adler=a.check=1,a.mode=X;case X:if(e===E||e===A)break t;case W:if(a.last){_>>>=7&u,u-=7&u,a.mode=ht;break}for(;u<3;){if(0===l)break t;l--,_+=n[s++]<<u,u+=8}switch(a.last=1&_,_>>>=1,u-=1,3&_){case 0:a.mode=J;break;case 1:if(d(a),a.mode=at,e===A){_>>>=2,u-=2;break t}break;case 2:a.mode=$;break;case 3:t.msg="invalid block type",a.mode=_t}_>>>=2,u-=2;break;case J:for(_>>>=7&u,u-=7&u;u<32;){if(0===l)break t;l--,_+=n[s++]<<u,u+=8}if((65535&_)!==(_>>>16^65535)){t.msg="invalid stored block lengths",a.mode=_t;break}if(a.length=65535&_,_=0,u=0,a.mode=Q,e===A)break t;case Q:a.mode=V;case V:if(g=a.length){if(g>l&&(g=l),g>h&&(g=h),0===g)break t;w.arraySet(r,n,s,g,o),l-=g,s+=g,h-=g,o+=g,a.length-=g;break}a.mode=X;break;case $:for(;u<14;){if(0===l)break t;
l--,_+=n[s++]<<u,u+=8}if(a.nlen=(31&_)+257,_>>>=5,u-=5,a.ndist=(31&_)+1,_>>>=5,u-=5,a.ncode=(15&_)+4,_>>>=4,u-=4,a.nlen>286||a.ndist>30){t.msg="too many length or distance symbols",a.mode=_t;break}a.have=0,a.mode=tt;case tt:for(;a.have<a.ncode;){for(;u<3;){if(0===l)break t;l--,_+=n[s++]<<u,u+=8}a.lens[At[a.have++]]=7&_,_>>>=3,u-=3}for(;a.have<19;)a.lens[At[a.have++]]=0;if(a.lencode=a.lendyn,a.lenbits=7,zt={bits:a.lenbits},xt=y(x,a.lens,0,19,a.lencode,0,a.work,zt),a.lenbits=zt.bits,xt){t.msg="invalid code lengths set",a.mode=_t;break}a.have=0,a.mode=et;case et:for(;a.have<a.nlen+a.ndist;){for(;St=a.lencode[_&(1<<a.lenbits)-1],gt=St>>>24,mt=St>>>16&255,wt=65535&St,!(gt<=u);){if(0===l)break t;l--,_+=n[s++]<<u,u+=8}if(wt<16)_>>>=gt,u-=gt,a.lens[a.have++]=wt;else{if(16===wt){for(Bt=gt+2;u<Bt;){if(0===l)break t;l--,_+=n[s++]<<u,u+=8}if(_>>>=gt,u-=gt,0===a.have){t.msg="invalid bit length repeat",a.mode=_t;break}yt=a.lens[a.have-1],g=3+(3&_),_>>>=2,u-=2}else if(17===wt){for(Bt=gt+3;u<Bt;){if(0===l)break t;l--,_+=n[s++]<<u,u+=8}_>>>=gt,u-=gt,yt=0,g=3+(7&_),_>>>=3,u-=3}else{for(Bt=gt+7;u<Bt;){if(0===l)break t;l--,_+=n[s++]<<u,u+=8}_>>>=gt,u-=gt,yt=0,g=11+(127&_),_>>>=7,u-=7}if(a.have+g>a.nlen+a.ndist){t.msg="invalid bit length repeat",a.mode=_t;break}for(;g--;)a.lens[a.have++]=yt}}if(a.mode===_t)break;if(0===a.lens[256]){t.msg="invalid code -- missing end-of-block",a.mode=_t;break}if(a.lenbits=9,zt={bits:a.lenbits},xt=y(z,a.lens,0,a.nlen,a.lencode,0,a.work,zt),a.lenbits=zt.bits,xt){t.msg="invalid literal/lengths set",a.mode=_t;break}if(a.distbits=6,a.distcode=a.distdyn,zt={bits:a.distbits},xt=y(B,a.lens,a.nlen,a.ndist,a.distcode,0,a.work,zt),a.distbits=zt.bits,xt){t.msg="invalid distances set",a.mode=_t;break}if(a.mode=at,e===A)break t;case at:a.mode=it;case it:if(l>=6&&h>=258){t.next_out=o,t.avail_out=h,t.next_in=s,t.avail_in=l,a.hold=_,a.bits=u,k(t,b),o=t.next_out,r=t.output,h=t.avail_out,s=t.next_in,n=t.input,l=t.avail_in,_=a.hold,u=a.bits,a.mode===X&&(a.back=-1);break}for(a.back=0;St=a.lencode[_&(1<<a.lenbits)-1],gt=St>>>24,mt=St>>>16&255,wt=65535&St,!(gt<=u);){if(0===l)break t;l--,_+=n[s++]<<u,u+=8}if(mt&&0===(240&mt)){for(pt=gt,vt=mt,kt=wt;St=a.lencode[kt+((_&(1<<pt+vt)-1)>>pt)],gt=St>>>24,mt=St>>>16&255,wt=65535&St,!(pt+gt<=u);){if(0===l)break t;l--,_+=n[s++]<<u,u+=8}_>>>=pt,u-=pt,a.back+=pt}if(_>>>=gt,u-=gt,a.back+=gt,a.length=wt,0===mt){a.mode=lt;break}if(32&mt){a.back=-1,a.mode=X;break}if(64&mt){t.msg="invalid literal/length code",a.mode=_t;break}a.extra=15&mt,a.mode=nt;case nt:if(a.extra){for(Bt=a.extra;u<Bt;){if(0===l)break t;l--,_+=n[s++]<<u,u+=8}a.length+=_&(1<<a.extra)-1,_>>>=a.extra,u-=a.extra,a.back+=a.extra}a.was=a.length,a.mode=rt;case rt:for(;St=a.distcode[_&(1<<a.distbits)-1],gt=St>>>24,mt=St>>>16&255,wt=65535&St,!(gt<=u);){if(0===l)break t;l--,_+=n[s++]<<u,u+=8}if(0===(240&mt)){for(pt=gt,vt=mt,kt=wt;St=a.distcode[kt+((_&(1<<pt+vt)-1)>>pt)],gt=St>>>24,mt=St>>>16&255,wt=65535&St,!(pt+gt<=u);){if(0===l)break t;l--,_+=n[s++]<<u,u+=8}_>>>=pt,u-=pt,a.back+=pt}if(_>>>=gt,u-=gt,a.back+=gt,64&mt){t.msg="invalid distance code",a.mode=_t;break}a.offset=wt,a.extra=15&mt,a.mode=st;case st:if(a.extra){for(Bt=a.extra;u<Bt;){if(0===l)break t;l--,_+=n[s++]<<u,u+=8}a.offset+=_&(1<<a.extra)-1,_>>>=a.extra,u-=a.extra,a.back+=a.extra}if(a.offset>a.dmax){t.msg="invalid distance too far back",a.mode=_t;break}a.mode=ot;case ot:if(0===h)break t;if(g=b-h,a.offset>g){if(g=a.offset-g,g>a.whave&&a.sane){t.msg="invalid distance too far back",a.mode=_t;break}g>a.wnext?(g-=a.wnext,m=a.wsize-g):m=a.wnext-g,g>a.length&&(g=a.length),bt=a.window}else bt=r,m=o-a.offset,g=a.length;g>h&&(g=h),h-=g,a.length-=g;do r[o++]=bt[m++];while(--g);0===a.length&&(a.mode=it);break;case lt:if(0===h)break t;r[o++]=a.length,h--,a.mode=it;break;case ht:if(a.wrap){for(;u<32;){if(0===l)break t;l--,_|=n[s++]<<u,u+=8}if(b-=h,t.total_out+=b,a.total+=b,b&&(t.adler=a.check=a.flags?v(a.check,r,b,o-b):p(a.check,r,b,o-b)),b=h,(a.flags?_:i(_))!==a.check){t.msg="incorrect data check",a.mode=_t;break}_=0,u=0}a.mode=dt;case dt:if(a.wrap&&a.flags){for(;u<32;){if(0===l)break t;l--,_+=n[s++]<<u,u+=8}if(_!==(4294967295&a.total)){t.msg="incorrect length check",a.mode=_t;break}_=0,u=0}a.mode=ft;case ft:xt=R;break t;case _t:xt=O;break t;case ut:return D;case ct:default:return N}return t.next_out=o,t.avail_out=h,t.next_in=s,t.avail_in=l,a.hold=_,a.bits=u,(a.wsize||b!==t.avail_out&&a.mode<_t&&(a.mode<ht||e!==S))&&f(t,t.output,t.next_out,b-t.avail_out)?(a.mode=ut,D):(c-=t.avail_in,b-=t.avail_out,t.total_in+=c,t.total_out+=b,a.total+=b,a.wrap&&b&&(t.adler=a.check=a.flags?v(a.check,r,b,t.next_out-b):p(a.check,r,b,t.next_out-b)),t.data_type=a.bits+(a.last?64:0)+(a.mode===X?128:0)+(a.mode===at||a.mode===Q?256:0),(0===c&&0===b||e===S)&&xt===Z&&(xt=I),xt)}function u(t){if(!t||!t.state)return N;var e=t.state;return e.window&&(e.window=null),t.state=null,Z}function c(t,e){var a;return t&&t.state?(a=t.state,0===(2&a.wrap)?N:(a.head=e,e.done=!1,Z)):N}function b(t,e){var a,i,n,r=e.length;return t&&t.state?(a=t.state,0!==a.wrap&&a.mode!==G?N:a.mode===G&&(i=1,i=p(i,e,r,0),i!==a.check)?O:(n=f(t,e,r,r))?(a.mode=ut,D):(a.havedict=1,Z)):N}var g,m,w=t("../utils/common"),p=t("./adler32"),v=t("./crc32"),k=t("./inffast"),y=t("./inftrees"),x=0,z=1,B=2,S=4,E=5,A=6,Z=0,R=1,C=2,N=-2,O=-3,D=-4,I=-5,U=8,T=1,F=2,L=3,H=4,j=5,K=6,M=7,P=8,Y=9,q=10,G=11,X=12,W=13,J=14,Q=15,V=16,$=17,tt=18,et=19,at=20,it=21,nt=22,rt=23,st=24,ot=25,lt=26,ht=27,dt=28,ft=29,_t=30,ut=31,ct=32,bt=852,gt=592,mt=15,wt=mt,pt=!0;a.inflateReset=s,a.inflateReset2=o,a.inflateResetKeep=r,a.inflateInit=h,a.inflateInit2=l,a.inflate=_,a.inflateEnd=u,a.inflateGetHeader=c,a.inflateSetDictionary=b,a.inflateInfo="pako inflate (from Nodeca project)"},{"../utils/common":3,"./adler32":5,"./crc32":7,"./inffast":10,"./inftrees":12}],12:[function(t,e,a){"use strict";var i=t("../utils/common"),n=15,r=852,s=592,o=0,l=1,h=2,d=[3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258,0,0],f=[16,16,16,16,16,16,16,16,17,17,17,17,18,18,18,18,19,19,19,19,20,20,20,20,21,21,21,21,16,72,78],_=[1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577,0,0],u=[16,16,16,16,17,17,18,18,19,19,20,20,21,21,22,22,23,23,24,24,25,25,26,26,27,27,28,28,29,29,64,64];e.exports=function(t,e,a,c,b,g,m,w){var p,v,k,y,x,z,B,S,E,A=w.bits,Z=0,R=0,C=0,N=0,O=0,D=0,I=0,U=0,T=0,F=0,L=null,H=0,j=new i.Buf16(n+1),K=new i.Buf16(n+1),M=null,P=0;for(Z=0;Z<=n;Z++)j[Z]=0;for(R=0;R<c;R++)j[e[a+R]]++;for(O=A,N=n;N>=1&&0===j[N];N--);if(O>N&&(O=N),0===N)return b[g++]=20971520,b[g++]=20971520,w.bits=1,0;for(C=1;C<N&&0===j[C];C++);for(O<C&&(O=C),U=1,Z=1;Z<=n;Z++)if(U<<=1,U-=j[Z],U<0)return-1;if(U>0&&(t===o||1!==N))return-1;for(K[1]=0,Z=1;Z<n;Z++)K[Z+1]=K[Z]+j[Z];for(R=0;R<c;R++)0!==e[a+R]&&(m[K[e[a+R]]++]=R);if(t===o?(L=M=m,z=19):t===l?(L=d,H-=257,M=f,P-=257,z=256):(L=_,M=u,z=-1),F=0,R=0,Z=C,x=g,D=O,I=0,k=-1,T=1<<O,y=T-1,t===l&&T>r||t===h&&T>s)return 1;for(var Y=0;;){Y++,B=Z-I,m[R]<z?(S=0,E=m[R]):m[R]>z?(S=M[P+m[R]],E=L[H+m[R]]):(S=96,E=0),p=1<<Z-I,v=1<<D,C=v;do v-=p,b[x+(F>>I)+v]=B<<24|S<<16|E|0;while(0!==v);for(p=1<<Z-1;F&p;)p>>=1;if(0!==p?(F&=p-1,F+=p):F=0,R++,0===--j[Z]){if(Z===N)break;Z=e[a+m[R]]}if(Z>O&&(F&y)!==k){for(0===I&&(I=O),x+=C,D=Z-I,U=1<<D;D+I<N&&(U-=j[D+I],!(U<=0));)D++,U<<=1;if(T+=1<<D,t===l&&T>r||t===h&&T>s)return 1;k=F&y,b[k]=O<<24|D<<16|x-g|0}}return 0!==F&&(b[x+F]=Z-I<<24|64<<16|0),w.bits=O,0}},{"../utils/common":3}],13:[function(t,e,a){"use strict";e.exports={2:"need dictionary",1:"stream end",0:"","-1":"file error","-2":"stream error","-3":"data error","-4":"insufficient memory","-5":"buffer error","-6":"incompatible version"}},{}],14:[function(t,e,a){"use strict";function i(t){for(var e=t.length;--e>=0;)t[e]=0}function n(t,e,a,i,n){this.static_tree=t,this.extra_bits=e,this.extra_base=a,this.elems=i,this.max_length=n,this.has_stree=t&&t.length}function r(t,e){this.dyn_tree=t,this.max_code=0,this.stat_desc=e}function s(t){return t<256?lt[t]:lt[256+(t>>>7)]}function o(t,e){t.pending_buf[t.pending++]=255&e,t.pending_buf[t.pending++]=e>>>8&255}function l(t,e,a){t.bi_valid>W-a?(t.bi_buf|=e<<t.bi_valid&65535,o(t,t.bi_buf),t.bi_buf=e>>W-t.bi_valid,t.bi_valid+=a-W):(t.bi_buf|=e<<t.bi_valid&65535,t.bi_valid+=a)}function h(t,e,a){l(t,a[2*e],a[2*e+1])}function d(t,e){var a=0;do a|=1&t,t>>>=1,a<<=1;while(--e>0);return a>>>1}function f(t){16===t.bi_valid?(o(t,t.bi_buf),t.bi_buf=0,t.bi_valid=0):t.bi_valid>=8&&(t.pending_buf[t.pending++]=255&t.bi_buf,t.bi_buf>>=8,t.bi_valid-=8)}function _(t,e){var a,i,n,r,s,o,l=e.dyn_tree,h=e.max_code,d=e.stat_desc.static_tree,f=e.stat_desc.has_stree,_=e.stat_desc.extra_bits,u=e.stat_desc.extra_base,c=e.stat_desc.max_length,b=0;for(r=0;r<=X;r++)t.bl_count[r]=0;for(l[2*t.heap[t.heap_max]+1]=0,a=t.heap_max+1;a<G;a++)i=t.heap[a],r=l[2*l[2*i+1]+1]+1,r>c&&(r=c,b++),l[2*i+1]=r,i>h||(t.bl_count[r]++,s=0,i>=u&&(s=_[i-u]),o=l[2*i],t.opt_len+=o*(r+s),f&&(t.static_len+=o*(d[2*i+1]+s)));if(0!==b){do{for(r=c-1;0===t.bl_count[r];)r--;t.bl_count[r]--,t.bl_count[r+1]+=2,t.bl_count[c]--,b-=2}while(b>0);for(r=c;0!==r;r--)for(i=t.bl_count[r];0!==i;)n=t.heap[--a],n>h||(l[2*n+1]!==r&&(t.opt_len+=(r-l[2*n+1])*l[2*n],l[2*n+1]=r),i--)}}function u(t,e,a){var i,n,r=new Array(X+1),s=0;for(i=1;i<=X;i++)r[i]=s=s+a[i-1]<<1;for(n=0;n<=e;n++){var o=t[2*n+1];0!==o&&(t[2*n]=d(r[o]++,o))}}function c(){var t,e,a,i,r,s=new Array(X+1);for(a=0,i=0;i<K-1;i++)for(dt[i]=a,t=0;t<1<<et[i];t++)ht[a++]=i;for(ht[a-1]=i,r=0,i=0;i<16;i++)for(ft[i]=r,t=0;t<1<<at[i];t++)lt[r++]=i;for(r>>=7;i<Y;i++)for(ft[i]=r<<7,t=0;t<1<<at[i]-7;t++)lt[256+r++]=i;for(e=0;e<=X;e++)s[e]=0;for(t=0;t<=143;)st[2*t+1]=8,t++,s[8]++;for(;t<=255;)st[2*t+1]=9,t++,s[9]++;for(;t<=279;)st[2*t+1]=7,t++,s[7]++;for(;t<=287;)st[2*t+1]=8,t++,s[8]++;for(u(st,P+1,s),t=0;t<Y;t++)ot[2*t+1]=5,ot[2*t]=d(t,5);_t=new n(st,et,M+1,P,X),ut=new n(ot,at,0,Y,X),ct=new n(new Array(0),it,0,q,J)}function b(t){var e;for(e=0;e<P;e++)t.dyn_ltree[2*e]=0;for(e=0;e<Y;e++)t.dyn_dtree[2*e]=0;for(e=0;e<q;e++)t.bl_tree[2*e]=0;t.dyn_ltree[2*Q]=1,t.opt_len=t.static_len=0,t.last_lit=t.matches=0}function g(t){t.bi_valid>8?o(t,t.bi_buf):t.bi_valid>0&&(t.pending_buf[t.pending++]=t.bi_buf),t.bi_buf=0,t.bi_valid=0}function m(t,e,a,i){g(t),i&&(o(t,a),o(t,~a)),N.arraySet(t.pending_buf,t.window,e,a,t.pending),t.pending+=a}function w(t,e,a,i){var n=2*e,r=2*a;return t[n]<t[r]||t[n]===t[r]&&i[e]<=i[a]}function p(t,e,a){for(var i=t.heap[a],n=a<<1;n<=t.heap_len&&(n<t.heap_len&&w(e,t.heap[n+1],t.heap[n],t.depth)&&n++,!w(e,i,t.heap[n],t.depth));)t.heap[a]=t.heap[n],a=n,n<<=1;t.heap[a]=i}function v(t,e,a){var i,n,r,o,d=0;if(0!==t.last_lit)do i=t.pending_buf[t.d_buf+2*d]<<8|t.pending_buf[t.d_buf+2*d+1],n=t.pending_buf[t.l_buf+d],d++,0===i?h(t,n,e):(r=ht[n],h(t,r+M+1,e),o=et[r],0!==o&&(n-=dt[r],l(t,n,o)),i--,r=s(i),h(t,r,a),o=at[r],0!==o&&(i-=ft[r],l(t,i,o)));while(d<t.last_lit);h(t,Q,e)}function k(t,e){var a,i,n,r=e.dyn_tree,s=e.stat_desc.static_tree,o=e.stat_desc.has_stree,l=e.stat_desc.elems,h=-1;for(t.heap_len=0,t.heap_max=G,a=0;a<l;a++)0!==r[2*a]?(t.heap[++t.heap_len]=h=a,t.depth[a]=0):r[2*a+1]=0;for(;t.heap_len<2;)n=t.heap[++t.heap_len]=h<2?++h:0,r[2*n]=1,t.depth[n]=0,t.opt_len--,o&&(t.static_len-=s[2*n+1]);for(e.max_code=h,a=t.heap_len>>1;a>=1;a--)p(t,r,a);n=l;do a=t.heap[1],t.heap[1]=t.heap[t.heap_len--],p(t,r,1),i=t.heap[1],t.heap[--t.heap_max]=a,t.heap[--t.heap_max]=i,r[2*n]=r[2*a]+r[2*i],t.depth[n]=(t.depth[a]>=t.depth[i]?t.depth[a]:t.depth[i])+1,r[2*a+1]=r[2*i+1]=n,t.heap[1]=n++,p(t,r,1);while(t.heap_len>=2);t.heap[--t.heap_max]=t.heap[1],_(t,e),u(r,h,t.bl_count)}function y(t,e,a){var i,n,r=-1,s=e[1],o=0,l=7,h=4;for(0===s&&(l=138,h=3),e[2*(a+1)+1]=65535,i=0;i<=a;i++)n=s,s=e[2*(i+1)+1],++o<l&&n===s||(o<h?t.bl_tree[2*n]+=o:0!==n?(n!==r&&t.bl_tree[2*n]++,t.bl_tree[2*V]++):o<=10?t.bl_tree[2*$]++:t.bl_tree[2*tt]++,o=0,r=n,0===s?(l=138,h=3):n===s?(l=6,h=3):(l=7,h=4))}function x(t,e,a){var i,n,r=-1,s=e[1],o=0,d=7,f=4;for(0===s&&(d=138,f=3),i=0;i<=a;i++)if(n=s,s=e[2*(i+1)+1],!(++o<d&&n===s)){if(o<f){do h(t,n,t.bl_tree);while(0!==--o)}else 0!==n?(n!==r&&(h(t,n,t.bl_tree),o--),h(t,V,t.bl_tree),l(t,o-3,2)):o<=10?(h(t,$,t.bl_tree),l(t,o-3,3)):(h(t,tt,t.bl_tree),l(t,o-11,7));o=0,r=n,0===s?(d=138,f=3):n===s?(d=6,f=3):(d=7,f=4)}}function z(t){var e;for(y(t,t.dyn_ltree,t.l_desc.max_code),y(t,t.dyn_dtree,t.d_desc.max_code),k(t,t.bl_desc),e=q-1;e>=3&&0===t.bl_tree[2*nt[e]+1];e--);return t.opt_len+=3*(e+1)+5+5+4,e}function B(t,e,a,i){var n;for(l(t,e-257,5),l(t,a-1,5),l(t,i-4,4),n=0;n<i;n++)l(t,t.bl_tree[2*nt[n]+1],3);x(t,t.dyn_ltree,e-1),x(t,t.dyn_dtree,a-1)}function S(t){var e,a=4093624447;for(e=0;e<=31;e++,a>>>=1)if(1&a&&0!==t.dyn_ltree[2*e])return D;if(0!==t.dyn_ltree[18]||0!==t.dyn_ltree[20]||0!==t.dyn_ltree[26])return I;for(e=32;e<M;e++)if(0!==t.dyn_ltree[2*e])return I;return D}function E(t){bt||(c(),bt=!0),t.l_desc=new r(t.dyn_ltree,_t),t.d_desc=new r(t.dyn_dtree,ut),t.bl_desc=new r(t.bl_tree,ct),t.bi_buf=0,t.bi_valid=0,b(t)}function A(t,e,a,i){l(t,(T<<1)+(i?1:0),3),m(t,e,a,!0)}function Z(t){l(t,F<<1,3),h(t,Q,st),f(t)}function R(t,e,a,i){var n,r,s=0;t.level>0?(t.strm.data_type===U&&(t.strm.data_type=S(t)),k(t,t.l_desc),k(t,t.d_desc),s=z(t),n=t.opt_len+3+7>>>3,r=t.static_len+3+7>>>3,r<=n&&(n=r)):n=r=a+5,a+4<=n&&e!==-1?A(t,e,a,i):t.strategy===O||r===n?(l(t,(F<<1)+(i?1:0),3),v(t,st,ot)):(l(t,(L<<1)+(i?1:0),3),B(t,t.l_desc.max_code+1,t.d_desc.max_code+1,s+1),v(t,t.dyn_ltree,t.dyn_dtree)),b(t),i&&g(t)}function C(t,e,a){return t.pending_buf[t.d_buf+2*t.last_lit]=e>>>8&255,t.pending_buf[t.d_buf+2*t.last_lit+1]=255&e,t.pending_buf[t.l_buf+t.last_lit]=255&a,t.last_lit++,0===e?t.dyn_ltree[2*a]++:(t.matches++,e--,t.dyn_ltree[2*(ht[a]+M+1)]++,t.dyn_dtree[2*s(e)]++),t.last_lit===t.lit_bufsize-1}var N=t("../utils/common"),O=4,D=0,I=1,U=2,T=0,F=1,L=2,H=3,j=258,K=29,M=256,P=M+1+K,Y=30,q=19,G=2*P+1,X=15,W=16,J=7,Q=256,V=16,$=17,tt=18,et=[0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0],at=[0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13],it=[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,3,7],nt=[16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15],rt=512,st=new Array(2*(P+2));i(st);var ot=new Array(2*Y);i(ot);var lt=new Array(rt);i(lt);var ht=new Array(j-H+1);i(ht);var dt=new Array(K);i(dt);var ft=new Array(Y);i(ft);var _t,ut,ct,bt=!1;a._tr_init=E,a._tr_stored_block=A,a._tr_flush_block=R,a._tr_tally=C,a._tr_align=Z},{"../utils/common":3}],15:[function(t,e,a){"use strict";function i(){this.input=null,this.next_in=0,this.avail_in=0,this.total_in=0,this.output=null,this.next_out=0,this.avail_out=0,this.total_out=0,this.msg="",this.state=null,this.data_type=2,this.adler=0}e.exports=i},{}],"/":[function(t,e,a){"use strict";var i=t("./lib/utils/common").assign,n=t("./lib/deflate"),r=t("./lib/inflate"),s=t("./lib/zlib/constants"),o={};i(o,n,r,s),e.exports=o},{"./lib/deflate":1,"./lib/inflate":2,"./lib/utils/common":3,"./lib/zlib/constants":6}]},{},[])("/")});