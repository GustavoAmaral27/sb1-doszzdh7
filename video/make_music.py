# Gera trilha original (sem direitos autorais) para o reel: 100 BPM, Am-F-C-G
import numpy as np, wave, sys
sr=44100; dur=36.0; bpm=100; beat=60/bpm
t=np.arange(int(sr*dur))/sr; out=np.zeros_like(t)
def env(n,a=.01,r=.3):
    x=np.arange(n)/sr; return np.minimum(x/a,1)*np.exp(-x/r)
def add(start,sig):
    i=int(start*sr); j=min(len(out),i+len(sig)); out[i:j]+=sig[:j-i]
# acordes (pad)
chords=[[57,60,64],[53,57,60],[48,52,55],[55,59,62]]
f=lambda m:440*2**((m-69)/12)
bar=beat*4
for k in range(int(dur/bar)+1):
    n=int(bar*sr); x=np.arange(n)/sr; s=np.zeros(n)
    for m in chords[k%4]:
        for det in (-0.12,0.12): s+=np.sin(2*np.pi*f(m+det/1)*x)+.3*np.sin(4*np.pi*f(m)*x)
    s*=np.minimum(x/.4,1)*np.minimum((bar-x)/.3,1)*.05
    add(k*bar,s)
    # baixo
    for b in range(4):
        n2=int(beat*sr); x2=np.arange(n2)/sr
        add(k*bar+b*beat, .22*np.sin(2*np.pi*f(chords[k%4][0]-24)*x2)*env(n2,.005,.25))
# bateria (entra forte após a abertura de 4s)
nb=int(dur/beat)
for b in range(nb):
    st=b*beat; lvl=.5 if st<4 else 1.0
    n=int(.35*sr); x=np.arange(n)/sr
    kick=np.sin(2*np.pi*(50+90*np.exp(-x*30))*x)*np.exp(-x*9)*.9*lvl
    add(st,kick)
    if st>=4:
        hn=int(.06*sr); add(st+beat/2,np.random.default_rng(b).normal(0,1,hn)*env(hn,.001,.02)*.12)
        if b%2==1:
            sn=int(.2*sr); add(st,np.random.default_rng(b+999).normal(0,1,sn)*env(sn,.001,.06)*.3)
# whooshes nas trocas de cena
for c in [4,8,12,16.5,22,26,29.5]:
    n=int(.6*sr); x=np.arange(n)/sr; nz=np.random.default_rng(int(c*10)).normal(0,1,n)
    nz=np.convolve(nz,np.ones(30)/30,'same'); add(c-.45,nz*np.sin(np.pi*x/.6)**2*.5)
# impacto no logo
n=int(1.5*sr); x=np.arange(n)/sr; add(8.1,np.sin(2*np.pi*(40+60*np.exp(-x*8))*x)*np.exp(-x*2.5)*.9)
out*=np.minimum(1,(dur-t)/2.0)  # fade out
out=np.tanh(out*1.2); out/=np.abs(out).max()*1.12
st=(np.stack([out,out],1)*32767).astype('<i2')
w=wave.open(sys.argv[1],'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(sr); w.writeframes(st.tobytes()); w.close()
