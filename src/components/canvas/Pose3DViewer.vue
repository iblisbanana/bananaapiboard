<script setup>
/**
 * Pose3DViewer.vue - 3D姿态识别和可视化组件
 * 
 * 功能：
 * 1. 从图片中检测多人姿态（使用 MediaPipe Pose）
 * 2. 在3D空间中渲染不同颜色的骨架小人
 * 3. 用户可自由旋转相机角度（正反打预览）
 * 4. 输出相机角度参数用于AI图片生成
 */
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

const props = defineProps({
  // 源图片URL
  imageUrl: {
    type: String,
    default: ''
  },
  // 是否显示
  visible: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'apply-angle', 'capture'])

// ========== 状态管理 ==========
const containerRef = ref(null)
const canvasRef = ref(null)
const videoRef = ref(null)

// 检测状态
const detecting = ref(false)
const detectProgress = ref('')
const detectError = ref('')

// 检测到的人物姿态数据
const detectedPoses = ref([])

// 当前相机角度
const cameraAngle = ref({
  azimuth: 0,      // 方位角 (0-360)
  elevation: 0,    // 仰角 (-90 to 90)
  distance: 5      // 距离
})

// Three.js 实例
let scene = null
let camera = null
let renderer = null
let controls = null
let animationFrameId = null
let skeletonGroups = []

// MediaPipe Pose 实例
let pose = null

// 人物颜色配置（最多支持8人）
const PERSON_COLORS = [
  0xff4444,  // 红色
  0x4444ff,  // 蓝色
  0x44ff44,  // 绿色
  0xffff44,  // 黄色
  0xff44ff,  // 紫色
  0x44ffff,  // 青色
  0xff8844,  // 橙色
  0x8844ff   // 紫罗兰
]

// MediaPipe 骨骼连接定义
const POSE_CONNECTIONS = [
  // 躯干
  [11, 12], // 左肩 - 右肩
  [11, 23], // 左肩 - 左髋
  [12, 24], // 右肩 - 右髋
  [23, 24], // 左髋 - 右髋
  // 左臂
  [11, 13], // 左肩 - 左肘
  [13, 15], // 左肘 - 左腕
  // 右臂
  [12, 14], // 右肩 - 右肘
  [14, 16], // 右肘 - 右腕
  // 左腿
  [23, 25], // 左髋 - 左膝
  [25, 27], // 左膝 - 左踝
  // 右腿
  [24, 26], // 右髋 - 右膝
  [26, 28], // 右膝 - 右踝
  // 头部
  [0, 1],   // 鼻 - 左眼内
  [0, 4],   // 鼻 - 右眼内
  [1, 2],   // 左眼内 - 左眼
  [2, 3],   // 左眼 - 左眼外
  [4, 5],   // 右眼内 - 右眼
  [5, 6],   // 右眼 - 右眼外
  [9, 10],  // 嘴左 - 嘴右
  [11, 0],  // 左肩 - 鼻（颈部近似）
  [12, 0],  // 右肩 - 鼻
]

// 关键关节点索引（用于绘制球体）
const KEY_LANDMARKS = [
  0,   // 鼻子
  11, 12,  // 肩膀
  13, 14,  // 肘部
  15, 16,  // 手腕
  23, 24,  // 髋部
  25, 26,  // 膝盖
  27, 28   // 脚踝
]

// 身体部位定义（用于创建立体胶囊人物）
const BODY_PARTS = [
  // 躯干
  { name: 'torso', start: 11, end: 23, radius: 0.12 },      // 左肩到左髋
  { name: 'torso', start: 12, end: 24, radius: 0.12 },      // 右肩到右髋
  { name: 'chest', start: 11, end: 12, radius: 0.1 },       // 肩膀连线
  { name: 'hip', start: 23, end: 24, radius: 0.1 },         // 髋部连线
  // 左臂
  { name: 'left_upper_arm', start: 11, end: 13, radius: 0.06 },
  { name: 'left_forearm', start: 13, end: 15, radius: 0.05 },
  // 右臂
  { name: 'right_upper_arm', start: 12, end: 14, radius: 0.06 },
  { name: 'right_forearm', start: 14, end: 16, radius: 0.05 },
  // 左腿
  { name: 'left_thigh', start: 23, end: 25, radius: 0.08 },
  { name: 'left_shin', start: 25, end: 27, radius: 0.06 },
  // 右腿
  { name: 'right_thigh', start: 24, end: 26, radius: 0.08 },
  { name: 'right_shin', start: 26, end: 28, radius: 0.06 },
  // 颈部
  { name: 'neck', start: 0, end: 11, radius: 0.04, midpoint: true },
]

// ========== 角度描述 ==========
const angleDescription = computed(() => {
  const azimuth = cameraAngle.value.azimuth
  const elevation = cameraAngle.value.elevation
  
  // 方位描述
  let azimuthDesc = '正面'
  if (azimuth >= 337.5 || azimuth < 22.5) azimuthDesc = '正面'
  else if (azimuth >= 22.5 && azimuth < 67.5) azimuthDesc = '左前方'
  else if (azimuth >= 67.5 && azimuth < 112.5) azimuthDesc = '左侧'
  else if (azimuth >= 112.5 && azimuth < 157.5) azimuthDesc = '左后方'
  else if (azimuth >= 157.5 && azimuth < 202.5) azimuthDesc = '背面'
  else if (azimuth >= 202.5 && azimuth < 247.5) azimuthDesc = '右后方'
  else if (azimuth >= 247.5 && azimuth < 292.5) azimuthDesc = '右侧'
  else if (azimuth >= 292.5 && azimuth < 337.5) azimuthDesc = '右前方'
  
  // 仰角描述
  let elevationDesc = '平视'
  if (elevation < -15) elevationDesc = '仰拍'
  else if (elevation > 30) elevationDesc = '俯拍'
  else if (elevation > 15) elevationDesc = '微俯'
  
  return `${azimuthDesc} · ${elevationDesc}`
})

// 生成提示词
const cameraPrompt = computed(() => {
  const azimuth = cameraAngle.value.azimuth
  const elevation = cameraAngle.value.elevation
  
  // 英文方位
  let azimuthLabel = 'front view'
  if (azimuth >= 337.5 || azimuth < 22.5) azimuthLabel = 'front view'
  else if (azimuth >= 22.5 && azimuth < 67.5) azimuthLabel = 'front-left quarter view'
  else if (azimuth >= 67.5 && azimuth < 112.5) azimuthLabel = 'left side view'
  else if (azimuth >= 112.5 && azimuth < 157.5) azimuthLabel = 'back-left quarter view'
  else if (azimuth >= 157.5 && azimuth < 202.5) azimuthLabel = 'back view'
  else if (azimuth >= 202.5 && azimuth < 247.5) azimuthLabel = 'back-right quarter view'
  else if (azimuth >= 247.5 && azimuth < 292.5) azimuthLabel = 'right side view'
  else if (azimuth >= 292.5 && azimuth < 337.5) azimuthLabel = 'front-right quarter view'
  
  // 英文仰角
  let elevationLabel = 'eye-level shot'
  if (elevation < -15) elevationLabel = 'low-angle shot'
  else if (elevation > 30) elevationLabel = 'high-angle shot'
  else if (elevation > 15) elevationLabel = 'elevated shot'
  
  return `${azimuthLabel}, ${elevationLabel}`
})

// ========== 初始化 Three.js ==========
function initThreeJS() {
  if (!containerRef.value) return
  
  const width = containerRef.value.clientWidth || 600
  const height = 400
  
  // 创建场景
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x1a1a1e)
  
  // 创建相机
  camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000)
  camera.position.set(0, 1.5, 5)
  
  // 创建渲染器
  renderer = new THREE.WebGLRenderer({ 
    antialias: true, 
    alpha: true,
    canvas: canvasRef.value
  })
  renderer.setSize(width, height)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  
  // 添加轨道控制器
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.05
  controls.target.set(0, 1, 0)
  controls.minDistance = 2
  controls.maxDistance = 15
  controls.maxPolarAngle = Math.PI * 0.9
  controls.update()
  
  // 监听控制器变化，更新角度
  controls.addEventListener('change', updateCameraAngle)
  
  // 添加网格地面
  const gridHelper = new THREE.GridHelper(10, 10, 0x444444, 0x333333)
  scene.add(gridHelper)
  
  // 添加坐标轴（小一点）
  const axesHelper = new THREE.AxesHelper(0.5)
  axesHelper.position.set(-4.5, 0, -4.5)
  scene.add(axesHelper)
  
  // 添加环境光
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.4)
  scene.add(ambientLight)
  
  // 主方向光（从上前方）
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
  directionalLight.position.set(5, 10, 8)
  scene.add(directionalLight)
  
  // 补光（从侧面）
  const fillLight = new THREE.DirectionalLight(0x8888ff, 0.3)
  fillLight.position.set(-5, 5, -5)
  scene.add(fillLight)
  
  // 底部反光
  const rimLight = new THREE.DirectionalLight(0xffffaa, 0.2)
  rimLight.position.set(0, -5, 0)
  scene.add(rimLight)
  
  // 添加地面参考圆
  const groundCircle = new THREE.Mesh(
    new THREE.CircleGeometry(2, 32),
    new THREE.MeshBasicMaterial({ 
      color: 0x333340, 
      transparent: true, 
      opacity: 0.3,
      side: THREE.DoubleSide
    })
  )
  groundCircle.rotation.x = -Math.PI / 2
  groundCircle.position.y = 0.01
  scene.add(groundCircle)
  
  // 开始渲染循环
  animate()
}

// 更新相机角度
function updateCameraAngle() {
  if (!camera || !controls) return
  
  const target = controls.target
  const position = camera.position
  
  // 计算相对于目标点的向量
  const dx = position.x - target.x
  const dy = position.y - target.y
  const dz = position.z - target.z
  
  // 计算距离
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)
  
  // 计算方位角（水平角度，0度为正前方/+Z方向）
  let azimuth = Math.atan2(dx, dz) * (180 / Math.PI)
  azimuth = ((azimuth % 360) + 360) % 360
  
  // 计算仰角
  const horizontalDist = Math.sqrt(dx * dx + dz * dz)
  let elevation = Math.atan2(dy - 1, horizontalDist) * (180 / Math.PI)
  
  cameraAngle.value = {
    azimuth: Math.round(azimuth),
    elevation: Math.round(elevation),
    distance: Math.round(distance * 10) / 10
  }
}

// 渲染循环
function animate() {
  animationFrameId = requestAnimationFrame(animate)
  
  if (controls) {
    controls.update()
  }
  
  if (renderer && scene && camera) {
    renderer.render(scene, camera)
  }
}

// ========== 姿态检测 ==========
async function initMediaPipe() {
  try {
    // 动态导入 MediaPipe
    const { Pose } = await import('@mediapipe/pose')
    
    pose = new Pose({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
      }
    })
    
    pose.setOptions({
      modelComplexity: 2,           // 最高精度模式（0=轻量, 1=中等, 2=重型）
      smoothLandmarks: true,
      enableSegmentation: false,
      smoothSegmentation: false,
      minDetectionConfidence: 0.7,  // 提高检测置信度阈值
      minTrackingConfidence: 0.7
    })
    
    pose.onResults(onPoseResults)
    
    console.log('[Pose3D] MediaPipe 初始化成功')
    return true
  } catch (error) {
    console.error('[Pose3D] MediaPipe 初始化失败:', error)
    return false
  }
}

// 姿态检测结果回调
function onPoseResults(results) {
  if (results.poseLandmarks) {
    // 单人检测结果
    detectedPoses.value = [results.poseLandmarks]
    
    // 🔧 调试：打印关键关节点坐标
    console.log('[Pose3D] 检测到姿态，关键点数量:', results.poseLandmarks.length)
    console.log('[Pose3D] 左肩(11):', results.poseLandmarks[11])
    console.log('[Pose3D] 右肩(12):', results.poseLandmarks[12])
    console.log('[Pose3D] 左腕(15):', results.poseLandmarks[15])
    console.log('[Pose3D] 右腕(16):', results.poseLandmarks[16])
    console.log('[Pose3D] 左髋(23):', results.poseLandmarks[23])
    console.log('[Pose3D] 右髋(24):', results.poseLandmarks[24])
    
    renderSkeletons()
  }
}

// 从图片检测姿态
async function detectPoseFromImage() {
  if (!props.imageUrl) {
    detectError.value = '请先选择图片'
    return
  }
  
  detecting.value = true
  detectProgress.value = '初始化检测模型...'
  detectError.value = ''
  
  try {
    // 初始化 MediaPipe
    if (!pose) {
      const success = await initMediaPipe()
      if (!success) {
        throw new Error('姿态检测模型加载失败')
      }
    }
    
    detectProgress.value = '加载图片...'
    
    // 创建图片元素
    const img = new Image()
    img.crossOrigin = 'anonymous'
    
    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = () => reject(new Error('图片加载失败'))
      img.src = props.imageUrl
    })
    
    detectProgress.value = '检测人物姿态...'
    
    // 发送到 MediaPipe 处理
    await pose.send({ image: img })
    
    detectProgress.value = '渲染3D骨架...'
    
    // 等待结果处理完成
    await new Promise(resolve => setTimeout(resolve, 500))
    
    if (detectedPoses.value.length === 0) {
      detectError.value = '未检测到人物姿态，请尝试其他图片'
    } else {
      detectProgress.value = `检测到 ${detectedPoses.value.length} 个人物`
    }
    
  } catch (error) {
    console.error('[Pose3D] 检测失败:', error)
    detectError.value = error.message || '检测失败'
  } finally {
    detecting.value = false
  }
}

// ========== 3D 骨架渲染 ==========
function renderSkeletons() {
  // 清除旧的骨架
  skeletonGroups.forEach(group => {
    scene.remove(group)
    group.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose()
      if (obj.material) obj.material.dispose()
    })
  })
  skeletonGroups = []
  
  // 为每个检测到的人渲染骨架
  detectedPoses.value.forEach((landmarks, personIndex) => {
    const color = PERSON_COLORS[personIndex % PERSON_COLORS.length]
    const skeleton = createSkeleton(landmarks, color, personIndex)
    scene.add(skeleton)
    skeletonGroups.push(skeleton)
  })
}

// 创建胶囊体几何体（模拟圆柱+两端半球）
function createCapsule(start, end, radius, material) {
  const group = new THREE.Group()
  
  const direction = new THREE.Vector3().subVectors(end, start)
  const length = direction.length()
  
  if (length < 0.01) return group  // 长度太短跳过
  
  // 创建圆柱体作为主体
  const cylinderGeometry = new THREE.CylinderGeometry(radius, radius, length, 12, 1)
  const cylinder = new THREE.Mesh(cylinderGeometry, material)
  
  // 两端的球体
  const sphereGeometry = new THREE.SphereGeometry(radius, 12, 8)
  const sphere1 = new THREE.Mesh(sphereGeometry, material)
  const sphere2 = new THREE.Mesh(sphereGeometry, material)
  
  sphere1.position.y = length / 2
  sphere2.position.y = -length / 2
  
  group.add(cylinder)
  group.add(sphere1)
  group.add(sphere2)
  
  // 计算位置和旋转
  const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5)
  group.position.copy(midpoint)
  
  // 旋转使胶囊体对齐方向
  const up = new THREE.Vector3(0, 1, 0)
  const quaternion = new THREE.Quaternion().setFromUnitVectors(up, direction.normalize())
  group.quaternion.copy(quaternion)
  
  return group
}

// 创建单个3D立体人物
function createSkeleton(landmarks, color, personIndex) {
  const group = new THREE.Group()
  group.name = `person_${personIndex}`
  
  // 使用 Phong 材质获得更好的立体感
  const bodyMaterial = new THREE.MeshPhongMaterial({ 
    color,
    shininess: 30,
    flatShading: false
  })
  
  const jointMaterial = new THREE.MeshPhongMaterial({ 
    color: new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.3),
    shininess: 50
  })
  
  // 🔧 改进的坐标转换
  // MediaPipe 坐标：x/y 是 0-1 归一化值，z 是相对深度（非常小的值，通常 -0.3 到 0.3）
  // z 值表示关节相对于髋部平面的前后距离，单位与图片宽度成比例
  
  // 先计算人物边界，用于自适应缩放
  const xs = landmarks.map(lm => lm.x)
  const ys = landmarks.map(lm => lm.y)
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys), maxY = Math.max(...ys)
  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2
  const scaleY = maxY - minY  // 人物占比
  
  // 根据人物大小自适应缩放（人物高度约 2 个单位）
  const targetHeight = 2.0
  const scale = scaleY > 0.1 ? targetHeight / scaleY : 2.5
  
  // 找到最低点（通常是脚踝），用于对齐地面
  const ankleY = Math.max(landmarks[27]?.y || 0, landmarks[28]?.y || 0, landmarks[31]?.y || 0, landmarks[32]?.y || 0)
  const groundOffset = ankleY > 0.5 ? (1 - ankleY) * scale : 0
  
  // 🔧 关键修复：MediaPipe 的 z 深度对静态图片非常不准确
  // 解决方案：几乎完全忽略 z 深度，只保留极小的深度变化用于视觉层次感
  // 这样 3D 模型会更接近 2.5D 效果，但姿势会更准确
  const Z_DEPTH_SCALE = 0.08  // 极小的深度缩放（原来是 0.3）
  
  const convertedLandmarks = landmarks.map((lm, idx) => {
    // X: 水平位置（左负右正），以人物中心为原点
    const x = (lm.x - centerX) * scale
    // Y: 垂直位置，底部对齐地面
    const y = (1 - lm.y) * scale + groundOffset
    
    // Z: 使用极小的深度值，主要用于前后层次感
    // 手腕和脚踝的 z 不可靠，强制设为 0
    let z = 0
    const unreliableIndices = [15, 16, 17, 18, 19, 20, 21, 22, 27, 28, 29, 30, 31, 32]  // 手部和脚部
    if (!unreliableIndices.includes(idx)) {
      z = Math.max(-0.3, Math.min(0.3, -lm.z * scale * Z_DEPTH_SCALE))
    }
    
    return {
      x,
      y,
      z,
      visibility: lm.visibility || 0.5
    }
  })
  
  console.log('[Pose3D] 坐标转换 | scale:', scale.toFixed(2), '| groundOffset:', groundOffset.toFixed(2), '| Z深度系数:', Z_DEPTH_SCALE)
  
  // 计算躯干中心点（用于颈部连接）
  const shoulderMid = {
    x: (convertedLandmarks[11].x + convertedLandmarks[12].x) / 2,
    y: (convertedLandmarks[11].y + convertedLandmarks[12].y) / 2,
    z: (convertedLandmarks[11].z + convertedLandmarks[12].z) / 2
  }
  
  // 创建头部（较大的球体）
  const headLm = convertedLandmarks[0]
  if (headLm.visibility > 0.3) {
    const headGeometry = new THREE.SphereGeometry(0.12, 16, 16)
    const head = new THREE.Mesh(headGeometry, bodyMaterial)
    head.position.set(headLm.x, headLm.y, headLm.z)
    group.add(head)
    
    // 颈部（从头到肩膀中心）
    const neckStart = new THREE.Vector3(headLm.x, headLm.y - 0.1, headLm.z)
    const neckEnd = new THREE.Vector3(shoulderMid.x, shoulderMid.y, shoulderMid.z)
    const neck = createCapsule(neckStart, neckEnd, 0.04, bodyMaterial)
    group.add(neck)
  }
  
  // 创建身体各部位的立体胶囊
  BODY_PARTS.forEach(part => {
    if (part.name === 'neck') return  // 颈部已单独处理
    
    const lm1 = convertedLandmarks[part.start]
    const lm2 = convertedLandmarks[part.end]
    
    if (lm1.visibility > 0.3 && lm2.visibility > 0.3) {
      const start = new THREE.Vector3(lm1.x, lm1.y, lm1.z)
      const end = new THREE.Vector3(lm2.x, lm2.y, lm2.z)
      
      const capsule = createCapsule(start, end, part.radius, bodyMaterial)
      group.add(capsule)
    }
  })
  
  // 关键关节点（用稍大的球体强调）
  const jointIndices = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]
  jointIndices.forEach(idx => {
    const lm = convertedLandmarks[idx]
    if (lm.visibility > 0.3) {
      const jointGeometry = new THREE.SphereGeometry(0.035, 12, 8)
      const joint = new THREE.Mesh(jointGeometry, jointMaterial)
      joint.position.set(lm.x, lm.y, lm.z)
      group.add(joint)
    }
  })
  
  // 手部（小球体）
  ;[15, 16].forEach(idx => {
    const lm = convertedLandmarks[idx]
    if (lm.visibility > 0.3) {
      const handGeometry = new THREE.SphereGeometry(0.05, 12, 8)
      const hand = new THREE.Mesh(handGeometry, bodyMaterial)
      hand.position.set(lm.x, lm.y, lm.z)
      group.add(hand)
    }
  })
  
  // 脚部（扁平的椭球）
  ;[27, 28].forEach(idx => {
    const lm = convertedLandmarks[idx]
    if (lm.visibility > 0.3) {
      const footGeometry = new THREE.SphereGeometry(0.06, 12, 8)
      const foot = new THREE.Mesh(footGeometry, bodyMaterial)
      foot.scale.set(1, 0.5, 1.5)  // 扁平化
      foot.position.set(lm.x, lm.y - 0.02, lm.z)
      group.add(foot)
    }
  })
  
  // 人物编号标签（头顶上方的小球）
  if (headLm) {
    const labelGeometry = new THREE.SphereGeometry(0.06, 12, 8)
    const labelMaterial = new THREE.MeshBasicMaterial({ 
      color: 0xffffff,
      transparent: true,
      opacity: 0.9
    })
    const label = new THREE.Mesh(labelGeometry, labelMaterial)
    label.position.set(headLm.x, headLm.y + 0.25, headLm.z)
    group.add(label)
    
    // 内部彩色小球表示人物编号
    const innerGeometry = new THREE.SphereGeometry(0.04, 12, 8)
    const innerMaterial = new THREE.MeshBasicMaterial({ color })
    const inner = new THREE.Mesh(innerGeometry, innerMaterial)
    inner.position.set(headLm.x, headLm.y + 0.25, headLm.z)
    group.add(inner)
  }
  
  return group
}

// ========== 预设视角 ==========
const viewPresets = [
  { label: '正面', azimuth: 0, elevation: 0, icon: '👤' },
  { label: '左侧', azimuth: 90, elevation: 0, icon: '◀' },
  { label: '背面', azimuth: 180, elevation: 0, icon: '🔙' },
  { label: '右侧', azimuth: 270, elevation: 0, icon: '▶' },
  { label: '俯视', azimuth: 0, elevation: 60, icon: '⬇' },
  { label: '仰视', azimuth: 0, elevation: -30, icon: '⬆' },
]

function applyPreset(preset) {
  if (!camera || !controls) return
  
  const distance = cameraAngle.value.distance || 5
  const target = controls.target
  
  // 计算新的相机位置
  const azimuthRad = preset.azimuth * (Math.PI / 180)
  const elevationRad = preset.elevation * (Math.PI / 180)
  
  const x = target.x + distance * Math.sin(azimuthRad) * Math.cos(elevationRad)
  const y = target.y + distance * Math.sin(elevationRad) + 1
  const z = target.z + distance * Math.cos(azimuthRad) * Math.cos(elevationRad)
  
  // 平滑过渡
  animateCameraTo(x, y, z)
}

// 相机平滑动画
function animateCameraTo(x, y, z) {
  const startPos = camera.position.clone()
  const endPos = new THREE.Vector3(x, y, z)
  const duration = 500
  const startTime = Date.now()
  
  function update() {
    const elapsed = Date.now() - startTime
    const t = Math.min(elapsed / duration, 1)
    const eased = 1 - Math.pow(1 - t, 3) // ease-out cubic
    
    camera.position.lerpVectors(startPos, endPos, eased)
    controls.update()
    
    if (t < 1) {
      requestAnimationFrame(update)
    }
  }
  
  update()
}

// ========== 操作按钮 ==========
function handleClose() {
  emit('close')
}

function handleApply() {
  emit('apply-angle', {
    azimuth: cameraAngle.value.azimuth,
    elevation: cameraAngle.value.elevation,
    distance: cameraAngle.value.distance,
    prompt: cameraPrompt.value,
    description: angleDescription.value
  })
}

function handleCapture() {
  if (!renderer) return
  
  // 截取当前3D视图
  const dataUrl = renderer.domElement.toDataURL('image/png')
  emit('capture', {
    image: dataUrl,
    angle: cameraAngle.value,
    prompt: cameraPrompt.value
  })
}

// 重置视角
function resetView() {
  if (!camera || !controls) return
  
  camera.position.set(0, 1.5, 5)
  controls.target.set(0, 1, 0)
  controls.update()
}

// ========== 生命周期 ==========
watch(() => props.visible, (visible) => {
  if (visible) {
    nextTick(() => {
      if (!scene) {
        initThreeJS()
      }
      // 如果有图片，自动开始检测
      if (props.imageUrl && detectedPoses.value.length === 0) {
        detectPoseFromImage()
      }
    })
  }
})

watch(() => props.imageUrl, (newUrl) => {
  if (newUrl && props.visible) {
    // 清除之前的检测结果
    detectedPoses.value = []
    detectPoseFromImage()
  }
})

onMounted(() => {
  if (props.visible) {
    nextTick(() => {
      initThreeJS()
    })
  }
})

onUnmounted(() => {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
  }
  
  if (controls) {
    controls.removeEventListener('change', updateCameraAngle)
    controls.dispose()
  }
  
  if (renderer) {
    renderer.dispose()
  }
  
  skeletonGroups.forEach(group => {
    group.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose()
      if (obj.material) obj.material.dispose()
    })
  })
  
  if (pose) {
    pose.close()
  }
})
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="pose3d-overlay" @click.self="handleClose">
      <div class="pose3d-panel">
        <!-- 标题栏 -->
        <div class="panel-header">
          <div class="panel-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="12" cy="5" r="3"/>
              <line x1="12" y1="8" x2="12" y2="16"/>
              <line x1="12" y1="12" x2="8" y2="10"/>
              <line x1="12" y1="12" x2="16" y2="10"/>
              <line x1="12" y1="16" x2="9" y2="22"/>
              <line x1="12" y1="16" x2="15" y2="22"/>
            </svg>
            <span>3D 姿态预览</span>
            <span class="beta-tag">Beta</span>
          </div>
          <button class="panel-close" @click="handleClose">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
        
        <!-- 3D 视口 -->
        <div class="viewport-container" ref="containerRef">
          <canvas ref="canvasRef"></canvas>
          
          <!-- 检测状态 -->
          <div v-if="detecting" class="detect-overlay">
            <div class="detect-spinner"></div>
            <span>{{ detectProgress }}</span>
          </div>
          
          <!-- 提示信息 -->
          <div class="viewport-hint">
            拖动旋转 · 滚轮缩放 · 右键平移
          </div>
          
          <!-- 人物图例 -->
          <div v-if="detectedPoses.length > 0" class="person-legend">
            <div 
              v-for="(_, index) in detectedPoses" 
              :key="index"
              class="legend-item"
              :style="{ '--color': '#' + PERSON_COLORS[index % PERSON_COLORS.length].toString(16).padStart(6, '0') }"
            >
              <span class="legend-dot"></span>
              <span>人物 {{ index + 1 }}</span>
            </div>
          </div>
        </div>
        
        <!-- 角度信息 -->
        <div class="angle-info">
          <div class="angle-description">{{ angleDescription }}</div>
          <div class="angle-values">
            <span>方位: {{ cameraAngle.azimuth }}°</span>
            <span>仰角: {{ cameraAngle.elevation }}°</span>
            <span>距离: {{ cameraAngle.distance }}</span>
          </div>
        </div>
        
        <!-- 快捷视角 -->
        <div class="preset-section">
          <div class="preset-label">快捷视角</div>
          <div class="preset-buttons">
            <button 
              v-for="preset in viewPresets" 
              :key="preset.label"
              class="preset-btn"
              :class="{ 
                active: Math.abs(cameraAngle.azimuth - preset.azimuth) < 30 && 
                        Math.abs(cameraAngle.elevation - preset.elevation) < 20 
              }"
              @click="applyPreset(preset)"
            >
              <span class="preset-icon">{{ preset.icon }}</span>
              <span class="preset-name">{{ preset.label }}</span>
            </button>
          </div>
        </div>
        
        <!-- 错误提示 -->
        <div v-if="detectError" class="error-message">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span>{{ detectError }}</span>
          <button @click="detectPoseFromImage">重试</button>
        </div>
        
        <!-- 操作按钮 -->
        <div class="action-buttons">
          <button class="action-btn secondary" @click="resetView">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
              <path d="M3 3v5h5"/>
            </svg>
            重置
          </button>
          <button class="action-btn secondary" @click="detectPoseFromImage" :disabled="detecting">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            重新检测
          </button>
          <button class="action-btn primary" @click="handleApply" :disabled="detectedPoses.length === 0">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M5 12l5 5L20 7"/>
            </svg>
            应用角度
          </button>
        </div>
        
        <!-- 提示词预览 -->
        <div class="prompt-preview">
          <span class="prompt-label">生成提示词：</span>
          <code class="prompt-code">{{ cameraPrompt }}</code>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.pose3d-overlay {
  position: fixed;
  inset: 0;
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.pose3d-panel {
  width: 90%;
  max-width: 680px;
  background: #1a1a1c;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  box-shadow: 0 25px 80px rgba(0, 0, 0, 0.7);
  overflow: hidden;
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  background: #222224;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  font-weight: 600;
  color: #e5e5e5;
}

.panel-title svg {
  width: 20px;
  height: 20px;
  color: #888;
}

.beta-tag {
  padding: 2px 8px;
  background: rgba(59, 130, 246, 0.2);
  border-radius: 10px;
  font-size: 10px;
  font-weight: 500;
  color: #60a5fa;
}

.panel-close {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: #666;
  cursor: pointer;
  transition: all 0.15s ease;
}

.panel-close:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

.panel-close svg {
  width: 16px;
  height: 16px;
}

/* 视口容器 */
.viewport-container {
  position: relative;
  width: 100%;
  height: 400px;
  background: #141416;
}

.viewport-container canvas {
  width: 100%;
  height: 100%;
}

.viewport-hint {
  position: absolute;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  padding: 4px 12px;
  background: rgba(0, 0, 0, 0.7);
  border-radius: 12px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  pointer-events: none;
}

/* 检测状态 */
.detect-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: rgba(0, 0, 0, 0.6);
  color: #ccc;
  font-size: 14px;
}

.detect-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 人物图例 */
.person-legend {
  position: absolute;
  top: 10px;
  right: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.7);
  border-radius: 8px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #ccc;
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--color);
}

/* 角度信息 */
.angle-info {
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.03);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.angle-description {
  font-size: 15px;
  font-weight: 600;
  color: #e5e5e5;
  margin-bottom: 4px;
}

.angle-values {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #777;
  font-family: 'SF Mono', Monaco, monospace;
}

/* 预设视角 */
.preset-section {
  padding: 12px 16px;
}

.preset-label {
  font-size: 12px;
  color: #777;
  margin-bottom: 8px;
}

.preset-buttons {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 8px;
}

.preset-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 8px;
  background: #2a2a2c;
  border: 1px solid transparent;
  border-radius: 8px;
  color: #888;
  cursor: pointer;
  transition: all 0.15s ease;
}

.preset-btn:hover {
  background: #333;
  color: #ccc;
}

.preset-btn.active {
  background: #3a3a3c;
  border-color: #555;
  color: #fff;
}

.preset-icon {
  font-size: 18px;
}

.preset-name {
  font-size: 11px;
}

/* 错误信息 */
.error-message {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  font-size: 13px;
}

.error-message svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.error-message button {
  margin-left: auto;
  padding: 4px 12px;
  background: rgba(239, 68, 68, 0.2);
  border: none;
  border-radius: 4px;
  color: #ef4444;
  font-size: 12px;
  cursor: pointer;
}

.error-message button:hover {
  background: rgba(239, 68, 68, 0.3);
}

/* 操作按钮 */
.action-buttons {
  display: flex;
  gap: 10px;
  padding: 12px 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 16px;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.action-btn svg {
  width: 16px;
  height: 16px;
}

.action-btn.secondary {
  background: #2a2a2c;
  color: #888;
}

.action-btn.secondary:hover:not(:disabled) {
  background: #333;
  color: #ccc;
}

.action-btn.primary {
  background: #3b82f6;
  color: #fff;
}

.action-btn.primary:hover:not(:disabled) {
  background: #2563eb;
}

.action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* 提示词预览 */
.prompt-preview {
  padding: 10px 16px;
  background: rgba(0, 0, 0, 0.2);
  font-size: 12px;
  color: #777;
}

.prompt-label {
  color: #555;
}

.prompt-code {
  color: #60a5fa;
  font-family: 'SF Mono', Monaco, monospace;
}
</style>

