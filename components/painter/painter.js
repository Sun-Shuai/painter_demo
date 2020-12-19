import Pen from './lib/pen';
import Downloader from './lib/downloader';

const downloader = new Downloader();
const MAX_PAINT_COUNT = 5;

Component({
  canvasWidthInPx: 0,
  canvasHeightInPx: 0,
  paintCount: 0,

  properties: {
    customStyle: {
      type: String,
    },
    palette: {
      type: Object,
      observer: function (newVal, oldVal) {
        if (this.isNeedRefresh(newVal, oldVal)) {
          this.paintCount = 0;
          this.startPaint();
        }
      },
    },
    widthPixels: {
      type: Number,
      value: 0
    }
  },

  data: {},

  methods: {

    isEmpty(object) {
      for (const i in object) {
        return false;
      }
      return true;
    },

    isNeedRefresh(newVal, oldVal) {
      if (!newVal || this.isEmpty(newVal)) {
        return false;
      }
      return true;
    },

    startPaint() {
      if (this.isEmpty(this.properties.palette)) {
        return;
      }

      if (!(getApp().systemInfo && getApp().systemInfo.screenWidth)) {
        try {
          getApp().systemInfo = wx.getSystemInfoSync();
        } catch (e) {
          const error = `Painter get system info failed, ${JSON.stringify(e)}`;
          that.triggerEvent('imgErr', {
            error: error
          });
          console.error(error);
          return;
        }
      }
      let screenK = getApp().systemInfo.screenWidth / 750;
      setStringPrototype(screenK, 1);

      this.downloadImages(this.properties.palette).then((palette) => {
        const {
          width,
          height
        } = palette;

        if (!width || !height) {
          console.error(`You should set width and height correctly for painter, width: ${width}, height: ${height}`);
          return;
        }
        this.canvasWidthInPx = width.toPx();
        if (this.properties.widthPixels) {
          setStringPrototype(screenK, this.properties.widthPixels / this.canvasWidthInPx)
          this.canvasWidthInPx = this.properties.widthPixels
        }

        this.canvasHeightInPx = height.toPx();
        this.setData({
          painterStyle: `width:${this.canvasWidthInPx}px;height:${this.canvasHeightInPx}px;`,
        });
        const ctx = wx.createCanvasContext('k-canvas', this);
        const pen = new Pen(ctx, palette);
        pen.paint(() => {
          this.saveImgToLocal();
        });
      });
    },

    downloadImages(palette) {
      return new Promise((resolve, reject) => {
        let preCount = 0;
        let completeCount = 0;
        const paletteCopy = JSON.parse(JSON.stringify(palette));
        if (paletteCopy.background) {
          preCount++;
          downloader.download(paletteCopy.background).then((path) => {
            paletteCopy.background = path;
            completeCount++;
            if (preCount === completeCount) {
              resolve(paletteCopy);
            }
          }, () => {
            completeCount++;
            if (preCount === completeCount) {
              resolve(paletteCopy);
            }
          });
        }
        if (paletteCopy.views) {
          for (const view of paletteCopy.views) {
            if (view && view.type === 'image' && view.url) {
              preCount++;
              downloader.download(view.url).then((path) => {
                view.url = path;
                wx.getImageInfo({
                  src: view.url,
                  success: (res) => {
                    view.sWidth = res.width;
                    view.sHeight = res.height;
                  },
                  fail: (error) => {
                    view.url = "";
                    console.error(`getImageInfo ${view.url} failed, ${JSON.stringify(error)}`);
                  },
                  complete: () => {
                    completeCount++;
                    if (preCount === completeCount) {
                      resolve(paletteCopy);
                    }
                  },
                });
              }, () => {
                completeCount++;
                if (preCount === completeCount) {
                  resolve(paletteCopy);
                }
              });
            }
          }
        }
        if (preCount === 0) {
          resolve(paletteCopy);
        }
      });
    },

    saveImgToLocal() {
      const that = this;
      setTimeout(() => {
        wx.canvasToTempFilePath({
          canvasId: 'photo',
          destWidth: that.canvasWidthInPx,
          destHeight: that.canvasHeightInPx,
          fileType: 'jpg',
          quality: 0.8,
          success: function (res) {
            that.getImageInfo(res.tempFilePath);
          },
          fail: function (error) {
            console.error(`canvasToTempFilePath failed, ${JSON.stringify(error)}`);
            that.triggerEvent('imgErr', {
              error: error
            });
          },
        }, this);
      }, 300);
    },

    getImageInfo(filePath) {
      const that = this;
      wx.getImageInfo({
        src: filePath,
        success: (infoRes) => {
          if (that.paintCount > MAX_PAINT_COUNT) {
            const error = `The result is always fault, even we tried ${MAX_PAINT_COUNT} times`;
            console.error(error);
            that.triggerEvent('imgErr', {
              error: error
            });
            return;
          }
          if (Math.abs((infoRes.width * that.canvasHeightInPx - that.canvasWidthInPx * infoRes.height) / (infoRes.height * that.canvasHeightInPx)) < 0.01) {
            that.triggerEvent('imgOK', {
              path: filePath
            });
          } else {
            that.startPaint();
          }
          that.paintCount++;
        },
        fail: (error) => {
          console.error(`getImageInfo failed, ${JSON.stringify(error)}`);
          that.triggerEvent('imgErr', {
            error: error
          });
        },
      });
    },
  },
});


function setStringPrototype(screenK, scale) {
  /**
   * 是否支持负数
   * @param {Boolean} minus 是否支持负数
   */
  String.prototype.toPx = function toPx(minus, baseSize) {
    if (this === '0') {
      return 0
    }
    let reg;
    if (minus) {
      reg = /^-?[0-9]+([.]{1}[0-9]+){0,1}(rpx|px|%)$/g;
    } else {
      reg = /^[0-9]+([.]{1}[0-9]+){0,1}(rpx|px|%)$/g;
    }
    const results = reg.exec(this);
    if (!this || !results) {
      console.error(`The size: ${this} is illegal`);
      return 0;
    }
    const unit = results[2];
    const value = parseFloat(this);

    let res = 0;
    if (unit === 'rpx') {
      res = Math.round(value * (screenK || 0.5) * (scale || 1));
    } else if (unit === 'px') {
      res = Math.round(value * (scale || 1));
    } else if (unit === '%') {
      res = Math.round(value * baseSize / 100);
    }
    return res;
  };
}