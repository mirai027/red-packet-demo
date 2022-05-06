

## 前言

新需求需要做个红包雨游戏，懂的都懂，具体逻辑参考如图：

<img src="https://vkceyugu.cdn.bspapp.com/VKCEYUGU-19eac695-d6e0-44e6-b825-78b5e9f5f7fd/e9af7986-cb19-4c10-b720-13bd216a9e13.gif" alt="23" style="zoom:50%;" />

冷静分析一下，无外乎就是

1. 红包下落动画
2. 点击红包+1动画
3. 游戏结束弹个优惠券

核心功能点就是红包的下落功能，第一反应就是。要么使用`canvas`、要么使用`CSS3`。自打我出生以来，我就一直有看到：

> 大量的DOM节点会导致性能垂直下降，div做动画，会不停的触发浏览器的回流重绘，这性能能好吗？而canvas就一个节点，性能扛扛的。

而我，也是这么想的。更何况`canvas`比`CSS3`动画复杂多了。以普遍理性而论，越复杂的东西，性能越好。

## Canvas方法

### 初始化画布

非常朴实无华的代码，传入宽高则canvas设置对应宽高，否则宽高为视口宽高。把 `canvas`上下文和宽高存起来方便后续使用。

```typescript
const redPacketsCanvasRef = ref<HTMLCanvasElement>()
const redPacketsContext = ref<ReturnType<typeof initCanvas>>()

function initCanvas(
  canvasElement: HTMLCanvasElement,
  params: { width?: number; height?: number } = {}
) {
  const canvasWidth = params.width ?? window.innerWidth
  const canvasHeight = params.height ?? window.innerHeight

  canvasElement.width = canvasWidth
  canvasElement.height = canvasHeight

  return {
    ctx: canvasElement.getContext('2d')!,
    params: {
      width: canvasWidth,
      height: canvasHeight,
    },
  }
}

onMounted(async () => {
  if (redPacketsCanvasRef.value) {
    redPacketsContext.value = initCanvas(redPacketsCanvasRef.value)
  }
})
```

### 绘制一个红包元素

每一个红包将会有如下属性，用于控制红包所有的行为。

```typescript
export type RedPacketType = {
  /** 红包 id */
  id: number
  /** x轴位置 */
  x: number
  /** y轴位置 */
  y: number
  /** 红包宽度 */
  width: number
  /** 红包高度 */
  height: number
  /** 红包下降速度 */
  speed: number
  /** 红包旋转最大角度 */
  rotate: number
  /** 红包旋转速度 */
  rotateSpeed: number
  /** 红包图片元素 */
  imageEl: HTMLImageElement
  /** 辅助红包被命中时判断的颜色值 */
  subHitColor: string
}
```

顺便再造一些假数据。

```typescript
type MockConfigType = {
  width?: number
  height?: number
  speed?: number
  imageUrl?: string
  maxRotateDeg?: number
  renderTime?: number
}
const props = withDefaults(defineProps<MockConfigType>(), {
  width: 80,
  height: 101,
  speed: 3,
  imageUrl: 'game-red-packet.png',
  maxRotateDeg: 30,
  renderTime: 1200,
})
```

生成红包时，我们需要做一些“合理”的准备（部分属性将在后面解释）。

1. 我们希望红包具有一个独一的 id，所以简单的以`Math.random() * 1e18`生成一个伪随机数作为 id值。
2. 红包必然不应该从屏幕(0, 0)的坐标直接出现，这样会显得很突兀。所以 y轴需要适当的向上移动 1.5个红包高度的距离，增加点下落时的违和感。
3. 红包雨必然是不止一个红包的移动的，所以需要把生成的红包存到一个数组里，后续将会统一绘制每一个红包来达到“动起来”的效果。

```typescript
const redPacketList = ref<Record<number | string, RedPacketType>>({})

async function createRedPacketItemObject({ x, y }: { x: number; y: number }) {
  const id = Math.random() * 1e18
  const { width, height, imageUrl, speed } = props
  const config: RedPacketType = {
    id,
    x,
    y: y - height * 1.5,
    width,
    height,
    imageEl: await loadImages(imageUrl),
    speed,
    rotate: 0,
    rotateSpeed: Math.round(Math.random()) ? 0.2 : -0.2,
    subHitColor: getHashColor(Object.values(redPacketList.value).map((x) => x.subHitColor ?? '')),
  }

  redPacketList.value[id] = config

  return config
}
```

适当改一下 y轴的位置，使用 `CanvasRenderingContext2D.drawImage()`绘制个红包康康先。

```typescript
onMounted(async () => {
  if (redPacketsCanvasRef.value) {
    redPacketsContext.value = initCanvas(redPacketsCanvasRef.value)

    const { imageEl, x, y, width, height } = await createRedPacketItemObject({ x: 40, y: 200 })
    redPacketsContext.value.ctx.drawImage(imageEl, x, y, width, height)
  }
})
```

<img src="https://vkceyugu.cdn.bspapp.com/VKCEYUGU-19eac695-d6e0-44e6-b825-78b5e9f5f7fd/b27ff30e-fcf3-42b3-b7e9-7e03947eebff.png" alt="image-20220421011544597" style="zoom:50%;" />

### 红包下落动画

红包已经绘制出来了，接下来就是让它能下落了。

红包的移动其实就是 **画布频繁的擦除和每一个红包元素**，每次绘制都改变下一次绘制时每个红包的 y轴位置，这样红包看起来就是在不停的下落了。以此为基础，我们只需要达成4个~~共识~~ 核心方法：

1. 使用`CanvasRenderingContext2D.clearRect()`清空画布。
2. 遍历`redPacketList数组`中的每一个红包元素，通过 `CanvasRenderingContext2D.drawImage()`绘制每一个红包，每个红包绘制完成后，更改当前红包的 y轴值为 红包的下降速度 + 当前 y轴值`redPacketList.value[id].y = y + speed`。
3. 判断红包是否已不在可视区域`if (redPacketList.value[id].y > canvasParams.height)`，不在可视区域时直接移除对象，避免红包堆积造成页面卡顿卡死。
4. 使用`requestAnimationFrame`让函数不断执行，完成动画。

```typescript
const rafRedPacketsMove = ref<number>()

async function renderRedPacketItem() {
  if (redPacketsContext.value) {
    const { ctx, params: canvasParams } = redPacketsContext.value
    ctx.clearRect(0, 0, canvasParams.width, canvasParams.height)

    for (const [id, redPacket] of Object.entries(redPacketList.value)) {
      const { y, speed } = redPacket
      const { imageEl, x, width, height } = redPacket
      ctx.drawImage(imageEl, x, y, width, height)
      redPacketList.value[id].y = y + speed

      if (redPacketList.value[id].y > canvasParams.height) {
        console.log(`[hidden-delete-${id}]`, redPacketList.value[id])
        delete redPacketList.value[id]
      }
    }

    rafRedPacketsMove.value = requestAnimationFrame(renderRedPacketItem)
  }
}

onMounted(async () => {
  if (redPacketsCanvasRef.value) {
    redPacketsContext.value = initCanvas(redPacketsCanvasRef.value)

    await createRedPacketItemObject({ x: 40, y: 0 })
    renderRedPacketItem()
  }
})
```



<img src="https://vkceyugu.cdn.bspapp.com/VKCEYUGU-19eac695-d6e0-44e6-b825-78b5e9f5f7fd/67c9a023-e037-402f-bf7c-cc30e22f1e32.gif" alt="1" style="zoom:50%;" />

### 红包自旋转动画

通常情况下，红包直直的下降会显得有点单调，所以我们可能会需要让红包在下落时稍微地左右旋转一下（其实是我看别人的红包雨旋转起来还挺好玩的）。

但 canvas的旋转是绕画布的左上角(0,0)开始旋转的，和 css默认的中心旋转不太一样，所以我们需要模拟一下 css的中心旋转。那就直接开干吧~

1. 避免“污染”画布后续操作，通过`CanvasRenderingContext2D.clearRect()`将当前状态放入栈中，**保存 canvas 全部状态**的方法。
2. 通过`CanvasRenderingContext2D.translate()`, 将 canvas 按原始 x点的水平方向、原始的 y点垂直方向进行**移动到红包的中心**。
3. 通过`CanvasRenderingContext2D.rotate()`旋转画布至需要的角度，此时绘制环境已经是旋转过了的。
4. 改变绘图环境的中心点坐标，回到原点，绘制红包图片。
5. 更改下一次旋转的`rotate`值。
6. 通过`CanvasRenderingContext2D.restore()`，**恢复**到最近的保存 canvas 全部状态的方法，也就是把`translate rotate `的状态复原一下。

可能文字不太好理解旋转部分，这里让我们借助一下PS的力量，以中心180deg旋转作为个栗子。

<img src="https://vkceyugu.cdn.bspapp.com/VKCEYUGU-19eac695-d6e0-44e6-b825-78b5e9f5f7fd/135e632e-483a-4c87-89cf-7ea31329a53d.gif" alt="3" style="zoom:50%;" />

由于旋转时即需要完成图片的绘制，所以需要改造一下`renderRedPacketItem`函数，把方法中的`ctx.drawImage(imageEl, x, y, width, height)`绘制图片交由给`function rotateRedPicketElement`绘制。

```typescript
async function renderRedPacketItem() {
  if (redPacketsContext.value) {
    const { ctx, params: canvasParams } = redPacketsContext.value
    ctx.clearRect(0, 0, canvasParams.width, canvasParams.height)

    for (const [id, redPacket] of Object.entries(redPacketList.value)) {
      const { y, speed } = redPacket
      rotateRedPicketElement(ctx, redPacket)
      redPacketList.value[id].y = y + speed

      if (redPacketList.value[id].y > canvasParams.height) {
        console.log(`[hidden-delete-${id}]`, redPacketList.value[id])
        delete redPacketList.value[id]
      }
    }

    rafRedPacketsMove.value = requestAnimationFrame(renderRedPacketItem)
  }
}

function rotateRedPicketElement(ctx: CanvasRenderingContext2D, params: RedPacketType) {
  function rotateThresholdValue(rotate: number) {
    const { maxRotateDeg } = props
    if (Math.abs(rotate) >= maxRotateDeg) {
      return rotate > 0 ? maxRotateDeg : -maxRotateDeg
    }
    return rotate
  }

  ctx.save()
  const { id, x, y, width, height, rotate, imageEl, rotateSpeed } = params
  const centerPointPosition = {
    x: x + width / 2,
    y: y + height / 2,
  }
  ctx.translate(centerPointPosition.x, centerPointPosition.y)
  ctx.rotate((rotate * Math.PI) / 180)
  ctx.translate(-centerPointPosition.x, -centerPointPosition.y)
  ctx.drawImage(imageEl, x, y, width, height)

  redPacketList.value[id].rotate = rotateThresholdValue(rotate + rotateSpeed)

  ctx.restore()
}
```

<img src="https://vkceyugu.cdn.bspapp.com/VKCEYUGU-19eac695-d6e0-44e6-b825-78b5e9f5f7fd/3bd7bf95-aa9b-4a80-8fc9-98bdd135c6a3.gif" alt="4" style="zoom:50%;" />

### 红包点击事件判断1（坐标轴计算）

生成了红包元素，自然是想着让用户点击后再搞点什么事情，所以点击事件是必须要有的。Canvas中并不能直接对我们绘制上去的某个“元素”进行点击事件的监听，我们只能通过监听Canvas的点击事件，根据坐标轴位置来进行点击的判定。

由于我们保存了每一个红包元素的`x, y`轴坐标以及图片的宽高，所以我们可以非常轻松的写出一段是否命中了红包的代码。

```typescript
function clickCanvas(e: MouseEvent, ctx: CanvasRenderingContext2D) {
  const { offsetX, offsetY } = e

  for (const [id, redPacketItem] of Object.entries(redPacketList.value)) {
    const { width, height, x, y } = redPacketItem
    const point = {
      x1: x,
      y1: y,
      x2: x + width,
      y2: y + height
    }
    const isHandle = offsetX >= point.x1 && offsetX <= point.x2 && offsetY >= point.y1 && offsetY <= point.y2
    if (isHandle) {
      delete redPacketList.value[id]
    }
  }
}

onMounted(async () => {
  if (redPacketsCanvasRef.value) {
    redPacketsContext.value = initCanvas(redPacketsCanvasRef.value)

    await createRedPacketItemObject({ x: 40, y: 0 })
    renderRedPacketItem()

    redPacketsCanvasRef.value.addEventListener('click', (e) => clickCanvas(e, redPacketsContext.value!.ctx))
  }
})
```

<img src="https://vkceyugu.cdn.bspapp.com/VKCEYUGU-19eac695-d6e0-44e6-b825-78b5e9f5f7fd/c8893732-69bf-4c42-bad7-249da4717383.gif" alt="5" style="zoom:50%;" />

此时会有个靓仔说到，“如果红包重叠了，那你怎么判断点击的是哪个啊？”

其实也很好解决，由于`canvas`绘制的图片，都是“一层一层往上叠”的，所以后生成的红包一定是在先生成的红包上的。那我们只需给每个红包都添加一个`zIndex`属性，每次生成红包的时候`zIndex++`。点击时，即可获取到命中的所有红包的信息，再拿到`zIndex`最大值的红包，既是我们肉眼看到的点击到的红包了。

```typescript
const redPacketAccumIndex = ref(1)

async function createRedPacketItemObject({ x, y }: { x: number; y: number }) {
  const id = Math.random() * 1e18
  const { width, height, imageUrl, speed } = props
  const config: RedPacketType = {
    id,
    x,
    y: y - height * 1.5,
    width,
    height,
    imageEl: await loadImages(imageUrl),
    speed,
    rotate: 0,
    rotateSpeed: Math.round(Math.random()) ? 0.2 : -0.2,
    subHitColor: getHashColor(Object.values(redPacketList.value).map((x) => x.subHitColor ?? '')),
    // 创建红包时给每个红包添加 zIndex值
    zIndex: redPacketAccumIndex.value++,
  }

function clickCanvas(e: MouseEvent, ctx: CanvasRenderingContext2D) {
  const { offsetX, offsetY } = e
  /** 范围命中的所有红包 */
  const isClickArray = []

  for (const [id, redPacketItem] of Object.entries(redPacketList.value)) {
    const { width, height, x, y } = redPacketItem
    const point = {
      x1: x,
      y1: y,
      x2: x + width,
      y2: y + height
    }
    const isHandle = offsetX >= point.x1 && offsetX <= point.x2 && offsetY >= point.y1 && offsetY <= point.y2
    if (isHandle) {
      isClickArray.push(redPacketItem)
    }
  }
  
  if (isClickArray[0]) {
    const sortArray = isClickArray.sort((a, b) => b.zIndex - a.zIndex)
    const { id } = sortArray[0]
    delete redPacketList.value[id]
  }
}
```

<img src="https://vkceyugu.cdn.bspapp.com/VKCEYUGU-19eac695-d6e0-44e6-b825-78b5e9f5f7fd/fcc27b16-740a-4cb4-8ba7-2b4945519b52.gif" alt="6" style="zoom:50%;" />

看着好像没什么问题，但总感觉...红包是一直旋转的，旋转你懂吧，就不能用上诉那简单的公式进行判断了，需要根据旋转角度再重新计算红包每个像素点的命中区域。目前的点击区域的判断只在绿色块上，旋转后的角度并没有重新计算。

<img src="https://vkceyugu.cdn.bspapp.com/VKCEYUGU-19eac695-d6e0-44e6-b825-78b5e9f5f7fd/e7afc290-3b4d-40d0-b42d-93e5984ad21a.gif" alt="7" style="zoom:50%;" />

### 红包点击事件判断2（模拟点击区域）

模拟点击区域的想法非常的简单粗暴。我们只需要在绘制红包时，同时绘制一个同样大小、位置的有独一无二颜色的图形。**在获取点击区域的像素的时候，找到拥有相同颜色的图形即可**。但因为不能影响原有绘制的图形，我们需要再创建一个辅助模拟点击的canvas盖在红包canvas上，设置css样式的透明度为0避免“污染”红包canvas，来完成我们的点击行为。

首先，我们需要有一个生成随机颜色的方法`getHashColor`来给每个红包赋予一个独一的颜色。

```typescript
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
```

其次，我们需要有一个辅助点击的canvas（为了方便理解，这里将透明度设置成 0.7）。

```vue
<script>
const hitSubCanvasRef = ref<HTMLCanvasElement>()
const hitSubCanvasContext = ref<ReturnType<typeof initCanvas>>()
</script>

<template>
  <canvas ref="redPacketsCanvasRef" />
  <canvas ref="hitSubCanvasRef" style="opacity: 0.7" />
</template>

<style>
canvas {
  position: absolute;
  top: 0;
  left: 0;
}
</style>
```

接着，我们主要改造一下`rotateRedPicketElement`绘制的方法。在绘制红包的同时，我们绘制一个一样位置、大小的带颜色的矩形。

```typescript
function rotateRedPicketElement(
  ctx: CanvasRenderingContext2D,
  params: RedPacketType,
  hitCtx: CanvasRenderingContext2D
) {
  function rotateThresholdValue(rotate: number) {
    const { maxRotateDeg } = props
    if (Math.abs(rotate) >= maxRotateDeg) {
      return rotate > 0 ? maxRotateDeg : -maxRotateDeg
    }
    return rotate
  }

  ctx.save()
  const { id, x, y, width, height, rotate, imageEl, rotateSpeed, subHitColor } = params
  const centerPointPosition = {
    x: x + width / 2,
    y: y + height / 2,
  }
  ctx.translate(centerPointPosition.x, centerPointPosition.y)
  ctx.rotate((rotate * Math.PI) / 180)
  ctx.translate(-centerPointPosition.x, -centerPointPosition.y)
  ctx.drawImage(imageEl, x, y, width, height)
  ctx.restore()

  hitCtx.save()
  hitCtx.translate(centerPointPosition.x, centerPointPosition.y)
  hitCtx.rotate((rotate * Math.PI) / 180)
  hitCtx.translate(-centerPointPosition.x, -centerPointPosition.y)
  hitCtx.fillStyle = subHitColor
  hitCtx.fillRect(x, y, width, height)
  hitCtx.restore()

  redPacketList.value[id].rotate = rotateThresholdValue(rotate + rotateSpeed)
}
```

最后，给辅助点击的canvas添加点击事件。

在用户点击的时候，我们只需要监听点击canvas的`click`事件，获取到`offsetX, offsetY`坐标。再通过`CanvasRenderingContext2D.getImageData()`获取到`rgb`值，从`redPacketList`中根据`rgb`值判断点击的是哪个红包即可。

```typescript
function hitSubCanvas(e: MouseEvent, ctx: CanvasRenderingContext2D) {
  const { offsetX, offsetY } = e

  const [r, g, b] = ctx.getImageData(offsetX, offsetY, 1, 1).data
  const rgb = `rgb(${r},${g},${b})`

  const hitRedPacketItem = Object.values(redPacketList.value).find((x) => x.subHitColor === rgb)

  if (hitRedPacketItem) {
    console.log(`[hit-delete-${hitRedPacketItem.id}]`, hitRedPacketItem)
    delete redPacketList.value[hitRedPacketItem.id]
  }
}

onMounted(async () => {
  if (redPacketsCanvasRef.value && hitSubCanvasRef.value) {
    redPacketsContext.value = initCanvas(redPacketsCanvasRef.value)
    hitSubCanvasContext.value = initCanvas(hitSubCanvasRef.value)

    await createRedPacketItemObject({ x: 40, y: 0 })
    renderRedPacketItem()

    hitSubCanvasRef.value.addEventListener('click', (e) =>
      hitSubCanvas(e, hitSubCanvasContext.value!.ctx)
    )
  }
})
```

因为是根据颜色来判断点击命中了，所以完全不需要担心红包重叠导致点击误判的问题了。

<img src="https://vkceyugu.cdn.bspapp.com/VKCEYUGU-19eac695-d6e0-44e6-b825-78b5e9f5f7fd/c3654afb-5984-4bc4-a929-1a295619a969.gif" alt="8" style="zoom:50%;" />



### 生成红包位置及下落方式

单个红包的从生成到下落动画逻辑都处理完了，接下来就需要处理多个红包的逻辑了。

#### 红包位置

我们希望红包可以有一定规律的落下，这里我们只需要满足：

1. 不与最近一次降落的红包重叠，且满足每组红包能在屏幕的每x列中能各出现一次。
2. 不出现在边界，避免用户不方便点击，同时也考虑到曲面屏手机的情况；

直接心算可能有点麻烦，这里直接进行反推来写计算函数`computedXPoint`。设定屏幕宽度为`375px`，红包宽度为`60px`，设置屏幕内边距`20px`。此时可以得到，每个红包直接的间距为`19px`。

<img src="https://vkceyugu.cdn.bspapp.com/VKCEYUGU-19eac695-d6e0-44e6-b825-78b5e9f5f7fd/88134517-3f5a-43fe-9c95-567786e963b8.png" alt="image-20220427004742683" style="zoom:50%;" />

不难观察到，屏幕内边距`20px`是一定存在的。第一个红包的位置为`sp20 + m19`、第二个红包位置为`sp20 + m19 + ( w60 + m19 )`、第三个红包位置为`sp20 + m19 + ( w60 + m19 ) + ( w60 + m19 )`，以此类推。

<img src="https://vkceyugu.cdn.bspapp.com/VKCEYUGU-19eac695-d6e0-44e6-b825-78b5e9f5f7fd/8ed4796b-aa73-48bd-9a05-5cabc321be76.png" alt="image-20220427005927365" style="zoom:50%;" />

规律已经很明显了，仿佛就可以很顺利的写出来 。

```typescript
function computedXPoint() {
  const { split, screenPadding, width } = props
  const maxScreenWidth = window.innerWidth - screenPadding * 2
  const maxFreeSpace = maxScreenWidth - width * split
  const marginSpace = maxFreeSpace / (split + 1)
  return Object.keys([...Array(split)]).map(Number).map(x => screenPadding + marginSpace + (width + marginSpace) * x)
}
```

关掉旋转，生成一下看看位置。

<img src="https://vkceyugu.cdn.bspapp.com/VKCEYUGU-19eac695-d6e0-44e6-b825-78b5e9f5f7fd/5e427351-781b-42b5-bc7e-e74c597f0436.gif" alt="9" style="zoom:50%;" />

#### 下落方式

位置都有了，接下来到下落动画了。下落方式同样需要满足几个条件：

1. 同一行中每次只会生成一个红包，避免红包生成过于整齐以至于降低了趣味性。
2. 红包不能以生成的位置数组直接按顺序下降，需要打乱数组，用于增加趣味性。

思路的话也很粗暴，提前生成红包数量的坐标数组，使用定时器一直往数组里添加红包，canvas负责绘制即可。

打乱数组的方法不需要太严谨，利用排序和随机数直接打乱即可

```typescript
function getRandomArray(array: number[]) {
  return array.sort(() => 0.5 - Math.random())
}
```

用于canvas的红包绘制已经由红包下落动画`renderRedPacketItem`函数对红包数组`redPacketList`不停的绘制。所以我们只需要无脑的写个定时器，定时往数组添加红包，即不停的执行`createRedPacketItemObject`函数创建红包即可。

```typescript
const pointList = computedXPoint()
const { split, totalPackets } = props
const allPointList = [...Array(Math.ceil(totalPackets / split))].map(() => getRandomArray(pointList)).flat().splice(0, totalPackets).map(Math.ceil)

let index = 0
let timer: number | null = null
createRedPacketItemObject({ x: allPointList[index++], y: 0 })
timer = setInterval(() => {
  if (index >= totalPackets - 1) {
    clearInterval(timer!)
  }
  createRedPacketItemObject({ x: allPointList[index++], y: 0 })
}, 700)
```

<img src="https://vkceyugu.cdn.bspapp.com/VKCEYUGU-19eac695-d6e0-44e6-b825-78b5e9f5f7fd/d7e1b101-cd9f-4d93-8591-33e9f351068e.gif" alt="10" style="zoom:50%;" />

### 翻船，部分机型浏览器卡顿严重

**小米浏览器**、**夸克浏览器**都是`chromium`内核，却出现了很明显的掉帧情况。看着那可能只有10帧的红包雨，内心毫无波澜。既然都是`chromium`，插上USB直接真机调试吧。

由于测试机只有4G的运存，所以以为可能是性能上存在问题。期间尝试了各种优化方案：虽然只有一个红包元素的图片但还是用上离屏渲染、使所有参数都避免存在浮点数而取整了。但并没有什么明显的效果，该卡的还是卡 ) :

![image-20220427013636073](https://vkceyugu.cdn.bspapp.com/VKCEYUGU-19eac695-d6e0-44e6-b825-78b5e9f5f7fd/ff7e530e-64ae-48eb-8c65-85551b352415.png)

无可奈何，使用 **Chrome**打开了游戏，**Chrome**浏览器稳定60帧（我累了）。

![image-20220427013659549](https://vkceyugu.cdn.bspapp.com/VKCEYUGU-19eac695-d6e0-44e6-b825-78b5e9f5f7fd/3ff27e6e-c86f-465e-8107-2bbf06f07a80.png)

看起来是浏览器套壳的同时，把系统调度优先级更改了？虽然感觉可能是代码写太飘了，但一个`requestAnimationFrame`也不至于掉帧这么严重吧。

没什么办法，canvas卡顿严重极大的影响了用户体验，解决不了卡顿问题那只能直接否掉了。用`@keyframes`写了个下落的动画在测试机跑了一下。嗯，60满帧，没有一丝丝卡顿。

## CSS3方法

使用`CSS3`进行红包雨游戏的编写，相对于`canvas`来说，完全就是降维打击。

同样的，我们也需要一个“画布容器”

```vue
<script setup lang="ts">
const gameContainerRef = ref<HTMLElement>()
</script>

<template>
  <div class="game-container" ref="gameContainerRef"></div>
</template>

<style lang="scss">
.game-container {
  width: 100vw;
  height: 100vh;
  margin: 0 auto;
  overflow: hidden;
}
</style>
```

### 创建一个红包元素

同样的假数据，同样的每个红包需要具有一个独一的 id

```vue
<script setup lang="ts">
function createRedPacket(xPonit: number) {
  const id = Math.random() * 1e18
  redPacketList.value.push(id)

  const { width, height, imageUrl } = props
  const packetEl = document.createElement('img')
  packetEl.src = new URL(`../assets/${imageUrl}`, import.meta.url).href
  packetEl.classList.add('red-packet-img')
  packetEl.id = 'packet-' + id
  packetEl.style.width = width + 'px'
  packetEl.style.height = height + 'px'
  packetEl.style.left = xPonit + 'px'

  gameContainerRef.value!.appendChild(packetEl)
}
    
onMounted(async () => {
  createRedPacket(20)
})
</script>

<template>
  <div class="game-container" ref="gameContainerRef"></div>
</template>

<style lang="scss">
.game-container {
  width: 100vw;
  height: 100vh;
  margin: 0 auto;
  overflow: hidden;

  .red-packet-img {
    position: absolute;
    top: 0;
    left: 0;
    // transform: translateY(-100%);
    font-size: 0;
  }
}
</style>
```

<img src="https://vkceyugu.cdn.bspapp.com/VKCEYUGU-19eac695-d6e0-44e6-b825-78b5e9f5f7fd/cec582f4-3d45-4e3f-a6ac-84e7b186370e.png" alt="image-20220428004518780" style="zoom:50%;" />

### 红包@keyframes下落动画

使用`CSS3`动画非常简单，我们只需要创建一个`@keyframes`关键帧来 **指定动画的开始和结束状态**。每个红包创建时，直接使用`animation`对红包创建动画。完全不需要计算，无脑堆API即可。

```vue
<style lang="scss">
.game-container {
  width: 100vw;
  height: 100vh;
  margin: 0 auto;
  overflow: hidden;

  .red-packet-img {
    position: absolute;
    top: 0;
    left: 0;
    transform: translateY(-100%);
    font-size: 0;
    animation: down 3s linear forwards;
  }

  @keyframes down {
    0% {
      transform: translateY(-100%);
    }

    100% {
      transform: translateY(110vh);
    }
  }
}
</style>
```

<img src="https://vkceyugu.cdn.bspapp.com/VKCEYUGU-19eac695-d6e0-44e6-b825-78b5e9f5f7fd/62e1faf8-276d-4339-aa30-14379cc2fa5e.gif" alt="11" style="zoom:50%;" />

### 红包自旋转动画

旋转动画由`transform: rotate();`来完成即可，但因为旋转的方向（正反）是随机生成的，而我们的`@keyframes`是`transform`是写死的。我们不可能为每个红包都动态生成一个`@keyframes`，所以需要改造一下HTML结构。

这里直接用一个比较取巧的办法。下落down的`@keyframes`是写死的，旋转rotate的`@keyframes`是需要动态的。那我们就给红包元素外层套一个父元素， **父元素负责下落动画**，**红包元素负责在里面执行旋转动画**。即：

1. 父元素设置`width, height, left, id`的属性，写入写死的下落down`@keyframes`
2. 红包元素`width, height`直接继承自父元素即可。动态设置红包元素的`transform: rotate();`值，再写死`transition`的过渡时间为下落时间即可。

```vue
<script setup lang="ts">
function createRedPacket(xPonit: number) {
  const id = Math.random() * 1e18
  redPacketList.value.push(id)

  const { width, height, imageUrl } = props

  const packetWrapperEl = document.createElement('div')
  packetWrapperEl.classList.add('red-packet-img-wrapper')
  packetWrapperEl.id = 'packet-' + id
  packetWrapperEl.style.width = width + 'px'
  packetWrapperEl.style.height = height + 'px'
  packetWrapperEl.style.left = xPonit + 'px'

  const packetEl = document.createElement('img')
  packetEl.src = new URL(`../assets/${imageUrl}`, import.meta.url).href
  packetEl.classList.add('red-packet-img')

  setTimeout(() => {
    packetEl.style.transform = `rotate(${Math.random() > 0.5 ? 30 : -30}deg)`
  }, 100);
  packetEl.onclick = () => false
  packetWrapperEl.appendChild(packetEl)
  gameContainerRef.value!.appendChild(packetWrapperEl)
}
</script>

<style lang="scss">
.game-container {
  width: 100vw;
  height: 100vh;
  max-width: 750px;
  margin: 0 auto;
  overflow: hidden;
  position: fixed;
  top: 0;
  left: 50%;
  transform: translateX(-50%);

  .red-packet-img-wrapper {
    position: absolute;
    top: 0;
    left: 0;
    transform: translateY(-100%);
    animation: down 3s linear forwards;
    font-size: 0;
    background-color: #39c5bb;
  }

  .red-packet-img {
    width: 100%;
    height: 100%;
    position: relative;
    transition: all 3s ease;
    transform: rotate(0);
  }

  @keyframes down {
    0% {
      transform: translateY(-100%);
    }

    100% {
      transform: translateY(110vh);
    }
  }
}
</style>
```

给父元素添加个背景，更好理解一些

<img src="https://vkceyugu.cdn.bspapp.com/VKCEYUGU-19eac695-d6e0-44e6-b825-78b5e9f5f7fd/f2ae8adb-42e8-44dc-bc87-79357cdc7551.gif" alt="12" style="zoom:50%;" />

### 红包点击事件判断

由于红包都是一个个的`div`，点击事件可以写得非常自然。为了方便秋后计算，我们把每个点击的红包id都存到`hitedPacketIdList`中，顺便也把防抖的功能加上。

```typescript
const hitedPacketIdList = ref<number[]>([])

function hitPacket(id: number) {
  if (!hitedPacketIdList.value.includes(id)) {
    hitedPacketIdList.value.push(id)
    const hitEl = document.querySelector(`#packet-${id}`)

    if (gameContainerRef.value && hitEl) {
      gameContainerRef.value.removeChild(hitEl)
    }
  }
}

function createRedPacket(xPonit: number) {
	// ...
    packetEl.onclick = () => hitPacket(id)
    // ...
}
```

<img src="https://vkceyugu.cdn.bspapp.com/VKCEYUGU-19eac695-d6e0-44e6-b825-78b5e9f5f7fd/d68cde13-1a39-4d1b-9d6f-9b4d725cfe74.gif" alt="13" style="zoom:50%;" />

### 生成红包位置及下落方式

没什么特别的，直接复制粘贴

```vue
<script setup lang="ts">
onMounted(async () => {
  const pointList = computedXPoint()
  const { split, totalPackets } = props
  const allPointList = [...Array(Math.ceil(totalPackets / split))].map(() => getRandomArray(pointList)).flat().splice(0, totalPackets).map(Math.ceil)

  let index = 0
  let timer: number | null = null
  createRedPacket(allPointList[index++])
  timer = setInterval(() => {
    if (index >= totalPackets - 1) {
      clearInterval(timer!)
    }
    createRedPacket(allPointList[index++])
  }, 700)
})
</script>
```

<img src="https://vkceyugu.cdn.bspapp.com/VKCEYUGU-19eac695-d6e0-44e6-b825-78b5e9f5f7fd/789aef66-3e80-4484-af4f-b77f304377d9.gif" alt="15" style="zoom:50%;" />

当然了，离开视图范围内的红包元素。我们定时每秒钟清理掉即可。这样DOM节点只会存量可视区域的少数量DOM，提高了性能。

<img src="https://vkceyugu.cdn.bspapp.com/VKCEYUGU-19eac695-d6e0-44e6-b825-78b5e9f5f7fd/7248670e-4566-4c04-bb97-d0536769fe27.gif" alt="16" style="zoom:50%;" />

### 扣点细节（提高用户体验）

#### 红包点击热区扩大

眼睛总是跟不上手指的。红包在不停的下落，是有可能会存在点击到屏幕时，红包已经下降到了点击位置的下方，导致游戏判断你并没有命中红包。为了方便我这种老年人反应的玩家，我们需要让红包拥有一个更大的上下点击热区。

实现也非常简单，父元素的高增加，红包元素添加同等的上下内边距即可。给红包也添加个背景看看效果（绿色为父元素，蓝色为红包点击热区）。

```vue
<script setup lang="ts">
function createRedPacket(xPonit: number) {
  // ...
  packetWrapperEl.style.height = height + padding * 2 + 'px'
  // ...
  packetEl.style.padding = `${padding}px 0`
  // ...
} 
</script>

<style lang="scss">
.game-container {
  // ...
  .red-packet-img {
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    position: relative;
    transition: all 3s ease;
    transform: rotate(0);
    background-color: #66ccff;
  }
  // ...
}
</style>
```

<img src="https://vkceyugu.cdn.bspapp.com/VKCEYUGU-19eac695-d6e0-44e6-b825-78b5e9f5f7fd/634f261f-e2f5-4ee6-ad59-327dd269b67e.gif" alt="14" style="zoom:50%;" />

#### 红包大小自适应

为了避免在小屏设备上红包过大，亦或者大屏设备上红包太小。红包大小的自适应自然是需要安排上的。不多说了，懂的都懂 [自适应布局方案](https://juejin.cn/post/6867874227832225805#heading-8) 。

```typescript
function getPx2VWSize(pixel: number) {
  const maxWindowInnerWidth = window.innerWidth 
  const design1px2vw = 1 / (750 / 100)
  const current1px2vw = pixel * design1px2vw * (maxWindowInnerWidth / 100)
  return current1px2vw
}
```

方法有了，那就给所有`width、height、padding`都套个函数即可。涉及的地方也只有两个函数`createRedPacket、computedXPoint`。

<img src="https://vkceyugu.cdn.bspapp.com/VKCEYUGU-19eac695-d6e0-44e6-b825-78b5e9f5f7fd/07d2521f-fbba-4b19-a201-a25ceebf9d77.png" alt="image-20220429003117466" style="zoom:50%;" />

<img src="https://vkceyugu.cdn.bspapp.com/VKCEYUGU-19eac695-d6e0-44e6-b825-78b5e9f5f7fd/3fc3e65f-adee-4ee2-ace1-541a064cc4d7.png" alt="image-20220429003133660" style="zoom:50%;" />

#### PC端适配

但用户在PC端打开游戏时，我们显然是不想让用户看到这种奇怪的东西。

<img src="https://vkceyugu.cdn.bspapp.com/VKCEYUGU-19eac695-d6e0-44e6-b825-78b5e9f5f7fd/2858294e-67a1-4fb0-8a0b-e25f8780af5a.png" alt="image-20220429003506920" style="zoom:50%;" />

所以，我们需要 **限制游戏容器的最大宽度，并进行居中处理**

```scss
.game-container {
  width: 100vw;
  height: 100vh;
  max-width: 750px;
  margin: 0 auto;
  overflow: hidden;
  position: fixed;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  // ...
}
```

最大宽度有了，自适应的方法自然也需要适配一下

```typescript
function computedXPoint() {
  const { split, screenPadding, width } = props
  const maxScreenWidth = (window.innerWidth > 750 ? 750 : window.innerWidth) - screenPadding * 2
  const maxFreeSpace = maxScreenWidth - getPx2VWSize(width) * split
  const marginSpace = maxFreeSpace / (split + 1)
  return Object.keys([...Array(split)]).map(Number).map(x => screenPadding + marginSpace + (getPx2VWSize(width) + marginSpace) * x)
}

function getPx2VWSize(pixel: number) {
  const maxWindowInnerWidth = window.innerWidth > 750 ? 750 : window.innerWidth
  const design1px2vw = 1 / (750 / 100)
  const current1px2vw = pixel * design1px2vw * (maxWindowInnerWidth / 100)
  return current1px2vw
}
```

<img src="https://vkceyugu.cdn.bspapp.com/VKCEYUGU-19eac695-d6e0-44e6-b825-78b5e9f5f7fd/1f5b646b-d0a3-418a-ad0f-9240b2367e48.png" alt="image-20220429004047426" style="zoom:50%;" />

大小解决了，但点击红包时，不小心手抖了一下。点击红包图片变成了长按拖拽图片，就会出现这种症状。

<img src="https://vkceyugu.cdn.bspapp.com/VKCEYUGU-19eac695-d6e0-44e6-b825-78b5e9f5f7fd/24f6ffce-2006-46b3-a5e4-dbee9042a7f5.gif" alt="19" style="zoom:50%;" />

手抖的症状很好治，我们直接把图片的拖拽事件给禁用了就好 (ಥ _ ಥ)

```typescript
function createRedPacket(xPonit: number) {
  // ...
  packetEl.ondragstart = () => false
  // ...
}
```

#### 点击反馈

点击了红包，没有一个 *+1*的反馈岂不是很不合理。实现也非常简单，点击命中红包后。在红包中心位置再添加一个 *+1图片*，图片适当加点动画，800ms后*+1图片*移除（消失）即可。

```vue
<script setup lang="ts">
function hitPacket(id: number) {
  if (!hitedPacketIdList.value.includes(id)) {
    hitedPacketIdList.value.push(id)
    const hitEl = document.querySelector(`#packet-${id}`)

    if (gameContainerRef.value && hitEl) {
      const { top, left, width, height } = hitEl.getBoundingClientRect()
      gameContainerRef.value.removeChild(hitEl)
      const topPoint = top + height / 2
      const lefPoint = left + width / 2
      const hitImageEl = document.createElement('img')
      hitImageEl.classList.add('hit-animation')
      hitImageEl.src = new URL(`../assets/add-done.png`, import.meta.url).href
      hitImageEl.style.position = 'absolute'
      hitImageEl.style.top = topPoint + 'px'
      hitImageEl.style.left = lefPoint + 'px'
      hitImageEl.style.width = getPx2VWSize(96) + 'px'
      hitImageEl.style.height = getPx2VWSize(50) + 'px'
      document.body.appendChild(hitImageEl)
      setTimeout(() => {
        document.body.removeChild(hitImageEl)
      }, 800)
    }
  }
}
</script>

<style>
.hit-animation {
  animation: rise 0.7s ease forwards;
}

@keyframes rise {
  0% {
    transform: translateY(0);
    opacity: 1;
  }

  100% {
    transform: translateY(-100%);
    opacity: 0;
  }
}
</style>
```



<img src="https://vkceyugu.cdn.bspapp.com/VKCEYUGU-19eac695-d6e0-44e6-b825-78b5e9f5f7fd/d2f8b0e8-3602-4a75-b5e5-e22e74c5fcb0.gif" alt="21" style="zoom:50%;" />

#### 提前加载图片

在用户网络不好的情况下，是很有可能发生游戏已经开始了，但红包图片还没加载出来的情况，用户看不到红包就会不知道要干什么。等加载出红包时，红包可能都已经销毁了好几个了，极度影响了我们的*送券计划*。所以我们在开始游戏前，需要提前把游戏涉及到的图片都一次性加载出来。

```typescript
async function loadAllImage() {
  const loading = Loading.service({ lock: true, fullscreen: false, background: 'transparent' })
  await Promise.all([
    loadImages(new URL('../assets/game-coupon.png', import.meta.url).href),
    loadImages(new URL('../assets/game-red-packet.png', import.meta.url).href),
    loadImages(new URL('../assets/add-done.png', import.meta.url).href),
  ])
  loading.close()
}
```

#### 优化红包点击事件

就目前来说，每创建一个红包，我们就会给每个红包绑定一个点击事件。对于一个有追求的人来说，这些性能就不该被浪费。我们完全可以利用 **事件委托**，只需要在游戏容器上绑定一个事件，就可以做到所有红包命中的点击反馈。

```vue
<script>
onMounted(async () => {
  if (gameContainerRef.value) {
    gameContainerRef.value.addEventListener('click', (e) => {
      const hitClassName = (e.target as HTMLElement).className
      if (hitClassName === 'red-packet-img') {
        const hitEl = (e as any).path[1]
        const id = hitEl.id
        
        if (!hitedPacketIdList.value.includes(id)) {
          hitedPacketIdList.value.push(id)
          const { top, left, width, height } = hitEl.getBoundingClientRect()
          gameContainerRef.value!.removeChild(hitEl)
          const topPoint = top + height / 2
          const lefPoint = left + width / 2
          const hitImageEl = document.createElement('img')
          hitImageEl.classList.add('hit-animation')
          hitImageEl.src = new URL(`../assets/add-done.png`, import.meta.url).href
          hitImageEl.style.position = 'absolute'
          hitImageEl.style.top = topPoint + 'px'
          hitImageEl.style.left = lefPoint + 'px'
          hitImageEl.style.width = getPx2VWSize(96) + 'px'
          hitImageEl.style.height = getPx2VWSize(50) + 'px'
          document.body.appendChild(hitImageEl)
          setTimeout(() => {
            document.body.removeChild(hitImageEl)
          }, 800)
        }
      }
    })
  }
})
</script>
</script>
```



## 加点特效（实现效果）

一切都准备完善了，加点样式，加些逻辑，一个红包雨功能就完成了。

![25](https://vkceyugu.cdn.bspapp.com/VKCEYUGU-19eac695-d6e0-44e6-b825-78b5e9f5f7fd/df6217ec-6641-4ba8-98b9-506a6f02837f.gif)

## 比比性能

CSS的最终表现分为以下四步：`Recalculate Style` -> `Layout` -> `Paint Setup and Paint` -> `Composite Layers`。

<img src="https://vkceyugu.cdn.bspapp.com/VKCEYUGU-19eac695-d6e0-44e6-b825-78b5e9f5f7fd/5eb4f6b3-a83b-4d90-9d66-1940795cf960.png" alt="image-20220428020956325" style="zoom:50%;" />

`ransform`是位于`Composite Layers`层，浏览器也会针对`transform`开启GPU加速。使用css3硬件加速，让动画不会引起回流重绘。

<img src="https://vkceyugu.cdn.bspapp.com/VKCEYUGU-19eac695-d6e0-44e6-b825-78b5e9f5f7fd/910828f3-4020-4f20-b2ce-161b8d45131d.png" alt="image-20220428021351130" style="zoom: 67%;" />

每个红包都有自己独立的合成层，我们打开`Layouts`看看图层就明白了。

![20](https://vkceyugu.cdn.bspapp.com/VKCEYUGU-19eac695-d6e0-44e6-b825-78b5e9f5f7fd/1cb47ade-bf58-47e8-9e77-7a7691a9a556.gif)

我们不妨生成更多的红包尝试一下。结果也是，游戏几乎满帧运行。

![17](https://vkceyugu.cdn.bspapp.com/VKCEYUGU-19eac695-d6e0-44e6-b825-78b5e9f5f7fd/cca2bf02-5055-4484-9811-b398c8053049.gif)

在我写的`canvas`方法中，同样的参数，虽然差距不是很大，但依旧是不能满帧，果然还是硬件加速更猛一点。

![22](https://vkceyugu.cdn.bspapp.com/VKCEYUGU-19eac695-d6e0-44e6-b825-78b5e9f5f7fd/bc2a2e0d-a211-4d24-bed8-c51f9f467426.gif)

## 总结一下

回过头想了想，红包雨需求并没有想象中那么复杂。最开始考虑的 **大量的DOM节点会导致性能垂直下降**问题，好像完全不需要考虑。因为红包雨的DOM节点，只会有你在屏幕上看到的个位数的红包数量。不在视野内的红包DOM节点早就被移除掉了。

所以说，简单的动画需求，用CSS3准没错，GPU加速的性能可不是开玩笑的。

至于复杂的功能，手写`canvas`也不现实。是`cocos`不香了吗？为什么要手写`canvas`游戏。

## 参考资料

1. [developers.google.cn - Google提供的渲染性能相关内容](https://link.juejin.cn/?target=https%3A%2F%2Fdevelopers.google.cn%2Fweb%2Ffundamentals%2Fperformance%2Frendering)
2. [【译文】HTML5 Canvas的点击区域检测以及如何监听Canvas上各种图形的点击事件](https://www.cnblogs.com/hanshuai/p/14385286.html)
3. [如何打造一款高可用的全屏红包雨](https://www.xiabingbao.com/post/canvas/canvas-redpackrain.html)#   r e d - p a c k e t - d e m o  
 