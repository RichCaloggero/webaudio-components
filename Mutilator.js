function Mutilator(data, name, context) {
  this.n = name || `mutilation-${+new Date()}`;
  this.d = data;
  this.c = context || window;
  this.isArr = function(p) {
    return this.d[p].constructor == Array;
  };
  this.dispatch = function(p, v, t) {
    this.c.dispatchEvent(
      new CustomEvent(this.n, {
        detail: {
          prop: p,
          val: v,
          type: t
        }
      })
    );
  };
}

Mutilator.prototype = {
  change: function(p, v) {
    this.d[p] = v;
    this.dispatch(p, v, "change");
  },
  add: function(p, v) {
    this.isArr(p) ? this.d[p].push(v) : (this.d[p] = [this.d[p], v]);
    this.dispatch(p, v, "add");
  },
  remove: function(p, v) {
    !this.isArr(p) ? delete this.d[p] : this.d[p].splice(v, 1);
    this.dispatch(p, p[v], "remove");
  },
  recoil: function(f, r) {
    this.c.addEventListener(this.n, e => {
      if (!r || r.some(p => e.detail.prop.indexOf(p) > -1)) {
        return f(e, this.d);
      }
    });
  }
};

export default Mutilator;