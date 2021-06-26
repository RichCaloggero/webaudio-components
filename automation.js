

export function compileFunction (text, parameter = "t") {
try {
return new Function (parameter,
`with (automationData) {
function  scale (x, in1,in2, out1,out2) {
in1 = Math.min(in1,in2);
in2 = Math.max(in1,in2);
out1 = Math.min(out1,out2);
out2 = Math.max(out1,out2);
const f = Math.abs(out1-out2) / Math.abs(in1-in2);

return f* Math.abs(x-in1) + out1;
} // scale

function s (x, l=-1.0, u=1.0) {return scale(Math.sin(x), -1,1, l,u);}
function c (x, l=-1.0, u=1.0) {return scale(Math.cos(x), -1,1, l,u);}
function r(a=0, b=1) {return scale(Math.random(), 0,1, a,b);}

return ${text};
} // Math
`); // new Function

} catch (e) {
app.statusMessage(e);
return null;
} // try
} // compileFunction
