function plugin(CodeMirror) {
  // 注册codeMirror的scrollToLine方法
  CodeMirror.defineExtension('scrollToLine', function scrollToLine(lineno) {
    // temporary fix: sometimes the first coordinate is incorrect,
    // resulting in a difference about +- 10 px,
    // call the scroll function twice fixes the problem.

    // 第一个参数为水平滚动的位置，第二个参数为垂直滚动的位置
    // this.charCoords方法获取指定位置的字符的坐标。
    // 这里传入的对象{ line: lineno, ch: 0 }表示要获取的位置是lineno行的第一个字符。
    // 'local'参数表示获取相对于滚动容器的坐标。
    // .top 表示该行顶部的垂直位置
    // 滚动两次为了到正确位置
    this.scrollTo(null, this.charCoords({ line: lineno, ch: 0 }, 'local').top);
    this.scrollTo(null, this.charCoords({ line: lineno, ch: 0 }, 'local').top);
  });
}

module.exports = {
  default() {
    return {
      plugin,
    };
  },
};
