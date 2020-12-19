//index.js

// import Card from '../../palette/singleImageExample';
import Card from '../../palette/posterExample';

Page({

  chooseImage: function () {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      success: res => {
        let path = res.tempFilePaths[0]
        wx.getImageInfo({
          src: path,
          success: res => {
            this.setData({
              // template: new Card().palette(path, res.width, res.height),
              template: new Card().palette(path,'Hello world', res.width, res.height),
            });
          }
        })
      },
    })
  },

  onImgOK(e) {
    this.setData({
      image: e.detail.path
    })
    wx.saveImageToPhotosAlbum({
      filePath: e.detail.path,
    });
  },

});