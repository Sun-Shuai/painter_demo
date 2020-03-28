export default class ImageExample {
  palette(photopath, imgwidth, imgheight) {
    console.log(imgwidth+'px', imgheight+'px')
    return ({
      width: imgwidth + 'px',
      height: imgheight + 'px',
      background: '#fff',
      views: [{
        type: 'image',
        url: photopath,
        css: {
          width: imgwidth + 'px',
          height: imgheight + 'px',
        }
      }],
    });
  }
}