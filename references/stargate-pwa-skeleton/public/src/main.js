const c=document.getElementById('view');const ctx=c.getContext('2d');
function r(){c.width=innerWidth;c.height=innerHeight;ctx.fillStyle='#000';ctx.fillRect(0,0,c.width,c.height);
ctx.strokeStyle='#00dfff';ctx.lineWidth=3;ctx.beginPath();ctx.arc(c.width*0.45,c.height*0.5,220,0,Math.PI*2);ctx.stroke();
requestAnimationFrame(r)}r();