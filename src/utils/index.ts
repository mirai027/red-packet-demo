export function getRandomArbitrary(min: number, max: number, fixed?: boolean) {
  if (fixed) {
    return (Math.random() * (max - min) + min).toFixed(1)
  }
  return Math.round(Math.random() * (max - min) + min)
}

export function getRandomColor() {
  const r = Math.round(Math.random() * 255)
  const g = Math.round(Math.random() * 255)
  const b = Math.round(Math.random() * 255)
  return `rgb(${r},${g},${b})`
}

export function getHashColor(hashColorList: string[]) {
  let hashColor = getRandomColor()
  for (;;) {
    if (!hashColorList.includes(hashColor)) {
      return hashColor
    }
    hashColor = getRandomColor()
  }
}

const loadImageList: Record<string, HTMLImageElement> = {}
export function loadImages(fileName: string): Promise<HTMLImageElement> {
  return new Promise((resolve) => {
    if (loadImageList[fileName]) {
      resolve(loadImageList[fileName])
      return
    }

    const image = new Image()
    image.src = new URL(`../assets/${fileName}`, import.meta.url).href
    image.onload = () => {
      loadImageList[fileName] = image
      resolve(image)
    }
  })
}

export function getPx2VWSize(pixel: number) {
  const design1px2vw = 1 / (750 / 100)
  const current1px2vw = pixel * design1px2vw * (window.innerWidth / 100)
  return current1px2vw
}

