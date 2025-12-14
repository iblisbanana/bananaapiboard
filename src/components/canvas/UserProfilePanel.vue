<script setup>
/**
 * UserProfilePanel.vue - 画布模式个人中心浮动面板
 * 点击左侧工具栏的P按钮时弹出
 */
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { redeemVoucher as redeemVoucherApi } from '@/api/client'
import { getTenantHeaders } from '@/config/tenant'
import { formatPoints, formatBalance } from '@/utils/format'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  userInfo: {
    type: Object,
    default: null
  },
  position: {
    type: Object,
    default: () => ({ x: 80, y: 100 })
  }
})

const emit = defineEmits(['close', 'update'])

const router = useRouter()
const token = localStorage.getItem('token')

// 当前激活的菜单
const activeMenu = ref('home')

// 数据
const ledger = ref([])
const packages = ref([])
const invite = ref({ invite_code: '', uses: [] })
const checkinStatus = ref({ hasCheckedInToday: false, consecutiveDays: 0 })
const loading = ref(false)

// 表单
const profileForm = ref({ username: '', email: '', bio: '' })
const passwordForm = ref({ oldPassword: '', newPassword: '', confirmPassword: '' })
const saveLoading = ref(false)

// 兑换券
const voucherCode = ref('')
const voucherLoading = ref(false)
const voucherError = ref('')
const voucherSuccess = ref('')

// 充值
const showRechargePanel = ref(false)
const rechargeAmount = ref(0)
const rechargeCustomAmount = ref('')
const rechargeLoading = ref(false)
const rechargeError = ref('')
const quickAmounts = [300, 500, 1000, 5000, 10000]
const paymentMethods = ref([])
const rechargeSelectedMethod = ref(null)
const rechargeCouponCode = ref('')
const appliedRechargeCoupon = ref(null)
const rechargeCouponDiscount = ref(0)
const rechargeCouponError = ref('')

// 余额划转
const transferAmount = ref('')
const transferLoading = ref(false)
const exchangeRate = ref(10) // 1元 = 10积分

// 自定义对话框
const dialog = ref({
  visible: false,
  type: 'alert', // 'alert' | 'confirm'
  title: '',
  message: '',
  confirmText: '确定',
  cancelText: '取消',
  onConfirm: null,
  onCancel: null
})

// 显示提示对话框
function showAlert(message, title = '提示') {
  return new Promise((resolve) => {
    dialog.value = {
      visible: true,
      type: 'alert',
      title,
      message,
      confirmText: '确定',
      onConfirm: () => {
        dialog.value.visible = false
        resolve(true)
      }
    }
  })
}

// 显示确认对话框
function showConfirm(message, title = '确认') {
  return new Promise((resolve) => {
    dialog.value = {
      visible: true,
      type: 'confirm',
      title,
      message,
      confirmText: '确定',
      cancelText: '取消',
      onConfirm: () => {
        dialog.value.visible = false
        resolve(true)
      },
      onCancel: () => {
        dialog.value.visible = false
        resolve(false)
      }
    }
  })
}

// 菜单列表（使用简洁的符号图标）
const menuItems = [
  { id: 'home', icon: 'home', label: '个人主页' },
  { id: 'profile', icon: 'settings', label: '账户管理' },
  { id: 'packages', icon: 'package', label: '订阅套餐' },
  { id: 'points', icon: 'diamond', label: '积分管理' },
  { id: 'voucher', icon: 'ticket', label: '兑换中心' },
  { id: 'invite', icon: 'gift', label: '邀请奖励' },
  { id: 'help', icon: 'help', label: '使用教程' }
]

// SVG 图标组件
const icons = {
  home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
  settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>`,
  package: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
  diamond: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3h12l4 6-10 13L2 9z"/><path d="M2 9h20"/><path d="M12 22L6 9"/><path d="M12 22l6-13"/></svg>`,
  ticket: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 9a3 3 0 013-3h14a3 3 0 013 3v0a3 3 0 01-3 3v0a3 3 0 00-3 3v0a3 3 0 01-3 3H5a3 3 0 01-3-3v-6z"/><path d="M13 6v2"/><path d="M13 12v2"/><path d="M13 16v2"/></svg>`,
  gift: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/></svg>`,
  help: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  calendar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  credit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`,
  logout: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
  copy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>`,
  link: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>`,
  book: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>`,
  brush: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9.06 11.9l8.07-8.06a2.85 2.85 0 114.03 4.03l-8.06 8.08"/><path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 00-3-3.02z"/></svg>`,
  message: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>`,
  star: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  coin: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v12"/><path d="M15 9.5a3 3 0 00-3-2.5c-1.7 0-3 1.1-3 2.5s1.3 2.5 3 2.5 3 1.1 3 2.5-1.3 2.5-3 2.5a3 3 0 01-3-2.5"/></svg>`
}

// 初始化数据
watch(() => props.visible, async (val) => {
  if (val) {
    await loadData()
    if (props.userInfo) {
      profileForm.value = {
        username: props.userInfo.username || '',
        email: props.userInfo.email || '',
        bio: props.userInfo.bio || ''
      }
    }
  }
}, { immediate: true })

// 加载数据
async function loadData() {
  if (!token) return
  loading.value = true
  
  try {
    const headers = { ...getTenantHeaders(), Authorization: `Bearer ${token}` }
    
    const [ledgerRes, packagesRes, inviteRes, checkinRes] = await Promise.all([
      fetch('/api/user/points', { headers }),
      fetch('/api/packages', { headers }),
      fetch('/api/user/invite-code', { headers }),
      fetch('/api/user/checkin-status', { headers })
    ])
    
    if (ledgerRes.ok) {
      const data = await ledgerRes.json()
      ledger.value = Array.isArray(data) ? data : (data.records || data.ledger || [])
    }
    if (packagesRes.ok) {
      const data = await packagesRes.json()
      packages.value = data.packages || []
    }
    if (inviteRes.ok) invite.value = await inviteRes.json()
    if (checkinRes.ok) checkinStatus.value = await checkinRes.json()
  } catch (e) {
    console.error('加载数据失败:', e)
  } finally {
    loading.value = false
  }
}

// 关闭面板
function closePanel() {
  emit('close')
}

// 签到
async function performCheckin() {
  if (checkinStatus.value.hasCheckedInToday) return
  
  try {
    const headers = { ...getTenantHeaders(), Authorization: `Bearer ${token}` }
    const res = await fetch('/api/user/checkin', { method: 'POST', headers })
    if (res.ok) {
      const data = await res.json()
      checkinStatus.value.hasCheckedInToday = true
      checkinStatus.value.consecutiveDays++
      emit('update')
      showAlert(`签到成功！获得 ${data.reward} 积分`, '🎉 签到成功')
    }
  } catch (e) {
    showAlert('签到失败，请稍后重试', '提示')
  }
}

// 兑换券
async function redeemVoucher() {
  if (!voucherCode.value.trim()) {
    voucherError.value = '请输入兑换码'
    return
  }
  
  voucherLoading.value = true
  voucherError.value = ''
  voucherSuccess.value = ''
  
  try {
    const result = await redeemVoucherApi(voucherCode.value.trim())
    voucherSuccess.value = result.message || '兑换成功'
    voucherCode.value = ''
    emit('update')
    setTimeout(() => { voucherSuccess.value = '' }, 3000)
  } catch (e) {
    voucherError.value = e.message || '兑换失败'
  } finally {
    voucherLoading.value = false
  }
}

// 保存资料
async function saveProfile() {
  saveLoading.value = true
  try {
    const headers = { 
      ...getTenantHeaders(), 
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
    const res = await fetch('/api/user/profile', {
      method: 'PUT',
      headers,
      body: JSON.stringify(profileForm.value)
    })
    if (res.ok) {
      emit('update')
      showAlert('资料保存成功', '✓ 成功')
    } else {
      showAlert('保存失败，请稍后重试', '提示')
    }
  } catch (e) {
    showAlert('保存失败，请稍后重试', '提示')
  } finally {
    saveLoading.value = false
  }
}

// 修改密码
async function changePassword() {
  if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) {
    showAlert('两次输入的密码不一致', '提示')
    return
  }
  if (passwordForm.value.newPassword.length < 6) {
    showAlert('新密码长度至少6位', '提示')
    return
  }
  
  saveLoading.value = true
  try {
    const headers = { 
      ...getTenantHeaders(), 
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
    const res = await fetch('/api/user/change-password', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        oldPassword: passwordForm.value.oldPassword,
        newPassword: passwordForm.value.newPassword
      })
    })
    if (res.ok) {
      showAlert('密码修改成功', '✓ 成功')
      passwordForm.value = { oldPassword: '', newPassword: '', confirmPassword: '' }
    } else {
      const data = await res.json()
      showAlert(data.error || '密码修改失败', '提示')
    }
  } catch (e) {
    showAlert('密码修改失败，请稍后重试', '提示')
  } finally {
    saveLoading.value = false
  }
}

// 购买套餐
async function purchasePackage(pkg) {
  // 检查余额是否足够
  if ((props.userInfo?.balance || 0) < pkg.price) {
    showAlert(`余额不足，当前余额 ¥${((props.userInfo?.balance || 0) / 100).toFixed(2)}，需要 ¥${(pkg.price / 100).toFixed(2)}`, '提示')
    return
  }
  
  const confirmed = await showConfirm(`确认使用余额购买「${pkg.name}」套餐？\n价格：¥${(pkg.price / 100).toFixed(2)}\n将获得 ${pkg.points} 积分`, '购买确认')
  if (!confirmed) return
  
  try {
    const headers = { 
      ...getTenantHeaders(), 
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
    const res = await fetch('/api/packages/purchase', {
      method: 'POST',
      headers,
      body: JSON.stringify({ package_id: pkg.id })
    })
    const data = await res.json()
    
    if (res.ok && !data.pay_url) {
      // 余额支付成功
      showAlert(data.message || `套餐购买成功！获得 ${pkg.points} 积分`, '🎉 购买成功')
      emit('update')
    } else if (data.pay_url) {
      // 需要跳转支付
      window.open(data.pay_url, '_blank')
    } else {
      showAlert(data.message || data.error || '购买失败', '提示')
    }
  } catch (e) {
    showAlert('购买失败，请稍后重试', '提示')
  }
}

// 打开充值面板
async function openRechargePanel() {
  showRechargePanel.value = true
  rechargeAmount.value = 0
  rechargeCustomAmount.value = ''
  rechargeSelectedMethod.value = null
  rechargeError.value = ''
  rechargeCouponCode.value = ''
  appliedRechargeCoupon.value = null
  rechargeCouponDiscount.value = 0
  rechargeCouponError.value = ''
  
  // 加载支付方式
  try {
    const headers = { ...getTenantHeaders(), Authorization: `Bearer ${token}` }
    const res = await fetch('/api/user/payment-methods', { headers })
    if (res.ok) {
      const data = await res.json()
      paymentMethods.value = data.methods || []
      if (paymentMethods.value.length > 0) {
        rechargeSelectedMethod.value = paymentMethods.value[0].id
      }
    }
  } catch (e) {
    console.error('[openRechargePanel] 加载支付方式失败:', e)
  }
}

// 获取最终充值金额（分）
function getFinalRechargeAmount() {
  if (rechargeAmount.value) {
    return parseInt(rechargeAmount.value)
  }
  if (rechargeCustomAmount.value) {
    const yuan = parseFloat(rechargeCustomAmount.value)
    if (yuan >= 1 && yuan <= 1500) {
      return Math.floor(yuan * 100)
    }
  }
  return 0
}

// 应用优惠券
async function applyRechargeCoupon() {
  if (!rechargeCouponCode.value || !rechargeCouponCode.value.trim()) {
    rechargeCouponError.value = '请输入优惠券码'
    return
  }
  
  const amount = getFinalRechargeAmount()
  if (amount < 100) {
    rechargeCouponError.value = '请先选择充值金额'
    return
  }
  
  try {
    const headers = {
      ...getTenantHeaders(),
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
    
    const res = await fetch('/api/coupons/validate', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        code: rechargeCouponCode.value.trim().toUpperCase(),
        package_id: null,
        amount: amount
      })
    })
    
    const data = await res.json()
    
    if (!res.ok) {
      rechargeCouponError.value = data.message || '优惠券验证失败'
      return
    }
    
    appliedRechargeCoupon.value = data.coupon
    rechargeCouponDiscount.value = data.discount_amount
    rechargeCouponError.value = ''
    showAlert('优惠券应用成功', '✓ 成功')
    
  } catch (e) {
    console.error('[applyRechargeCoupon] error:', e)
    rechargeCouponError.value = '优惠券验证失败，请重试'
  }
}

// 移除优惠券
function removeRechargeCoupon() {
  rechargeCouponCode.value = ''
  appliedRechargeCoupon.value = null
  rechargeCouponDiscount.value = 0
  rechargeCouponError.value = ''
}

// 充值
async function submitRecharge() {
  const amount = getFinalRechargeAmount()
  
  if (amount < 100) {
    rechargeError.value = '最低充值金额为1元'
    showAlert(rechargeError.value, '提示')
    return
  }
  if (amount > 150000) {
    rechargeError.value = '单笔最高充值1500元'
    showAlert(rechargeError.value, '提示')
    return
  }
  if (!rechargeSelectedMethod.value) {
    rechargeError.value = '请选择支付方式'
    showAlert(rechargeError.value, '提示')
    return
  }
  
  rechargeLoading.value = true
  rechargeError.value = ''
  
  try {
    const headers = { 
      ...getTenantHeaders(), 
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
    
    const payload = {
      amount: amount,
      payment_method_id: rechargeSelectedMethod.value
    }
    
    // 如果使用了优惠券，添加优惠券码
    if (appliedRechargeCoupon.value) {
      payload.coupon_code = rechargeCouponCode.value.trim().toUpperCase()
    }
    
    const res = await fetch('/api/user/recharge', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    })
    
    const data = await res.json()
    
    if (!res.ok) {
      throw new Error(data.message || '创建订单失败')
    }
    
    // 跳转到支付页面前，设置待刷新标记
    if (data.pay_url) {
      localStorage.setItem('pending_payment_refresh', 'true')
      localStorage.setItem('payment_timestamp', Date.now().toString())
      window.location.href = data.pay_url
    } else {
      showAlert('充值订单已创建', '✓ 成功')
      showRechargePanel.value = false
    }
  } catch (e) {
    rechargeError.value = e.message || '充值失败，请重试'
    showAlert(rechargeError.value, '提示')
  } finally {
    rechargeLoading.value = false
  }
}

// 余额划转
async function submitTransfer() {
  const yuan = parseFloat(transferAmount.value)
  if (!yuan || yuan <= 0) {
    showAlert('请输入划转金额', '提示')
    return
  }
  
  if (yuan < 1) {
    showAlert('最低划转金额为1元', '提示')
    return
  }
  
  const amountInCents = Math.floor(yuan * 100) // 转换为分
  const points = Math.floor(yuan * exchangeRate.value)
  
  // 检查余额是否足够
  if (props.userInfo?.balance < amountInCents) {
    showAlert(`余额不足，当前余额 ¥${((props.userInfo?.balance || 0) / 100).toFixed(2)}`, '提示')
    return
  }
  
  const confirmed = await showConfirm(`确认将 ¥${yuan.toFixed(2)} 余额划转为 ${points} 永久积分？`, '划转确认')
  if (!confirmed) return
  
  transferLoading.value = true
  try {
    const headers = { 
      ...getTenantHeaders(), 
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
    const res = await fetch('/api/user/balance-to-points', {
      method: 'POST',
      headers,
      body: JSON.stringify({ amount: amountInCents })
    })
    const data = await res.json()
    if (res.ok) {
      showAlert(data.message || `划转成功！获得 ${data.points || points} 永久积分`, '🎉 划转成功')
      transferAmount.value = ''
      emit('update')
    } else {
      showAlert(data.message || data.error || '划转失败', '提示')
    }
  } catch (e) {
    showAlert('划转失败，请稍后重试', '提示')
  } finally {
    transferLoading.value = false
  }
}

// 复制邀请码
function copyInviteCode() {
  if (invite.value.invite_code) {
    navigator.clipboard.writeText(invite.value.invite_code)
    showAlert('邀请码已复制到剪贴板', '✓ 复制成功')
  }
}

// 复制邀请链接
function copyInviteLink() {
  const link = `${window.location.origin}/?invite=${invite.value.invite_code}`
  navigator.clipboard.writeText(link)
  showAlert('邀请链接已复制到剪贴板', '✓ 复制成功')
}

// 退出登录
async function logout() {
  const confirmed = await showConfirm('确认退出登录？', '退出确认')
  if (confirmed) {
    localStorage.removeItem('token')
    localStorage.removeItem('userMode')
    router.push('/')
  }
}

// 跳转到帮助
function goToHelp() {
  // 可以打开帮助弹窗或跳转
  window.open('/help', '_blank')
}

// 格式化时间
function formatTime(ts) {
  return new Date(ts).toLocaleString('zh-CN')
}

// 格式化过期时间
function formatExpireTime(ts) {
  if (!ts) return ''
  const days = Math.ceil((ts - Date.now()) / 86400000)
  return days > 0 ? `${days}天后过期` : '已过期'
}

// 获取积分图标类型
function getLedgerIconType(type) {
  const iconMap = { 
    register: 'gift', 
    checkin: 'calendar', 
    invite: 'gift', 
    generate: 'brush', 
    recharge: 'credit', 
    package: 'package' 
  }
  return iconMap[type] || 'coin'
}

// 获取积分类型文字
function getLedgerTypeText(type) {
  const texts = { 
    register: '注册奖励', 
    checkin: '签到奖励', 
    daily_checkin: '每日签到',
    invite: '邀请奖励', 
    inviter_reward: '邀请奖励',
    invitee_reward: '被邀请奖励',
    generate: '生成消耗', 
    generate_cost: '生成消耗',
    generate_cost_package: '套餐积分消耗',
    generate_cost_permanent: '永久积分消耗',
    video_generation: '视频生成',
    image_generation: '图片生成',
    recharge: '充值', 
    balance_transfer: '余额划转',
    balance_to_points: '余额划转积分',
    package: '套餐购买',
    package_purchase: '套餐购买',
    voucher: '兑换码',
    voucher_redeem: '兑换码兑换',
    admin_adjust: '管理员调整',
    refund: '退款'
  }
  return texts[type] || type
}
</script>

<template>
  <Teleport to="body">
    <Transition name="panel">
      <div v-if="visible" class="profile-panel-overlay" @click.self="closePanel">
        <div 
          class="profile-panel"
          :style="{ left: `${position.x}px`, top: `${position.y}px` }"
        >
          <!-- 用户信息头部 -->
          <div class="panel-header">
            <div class="user-avatar">
              {{ userInfo?.username?.charAt(0)?.toUpperCase() || 'U' }}
            </div>
            <div class="user-info">
              <h3 class="user-name">{{ userInfo?.username || '用户' }}</h3>
              <p class="user-email">{{ userInfo?.email || '未绑定邮箱' }}</p>
            </div>
            <button class="close-btn" @click="closePanel">×</button>
          </div>

          <!-- 快捷数据 -->
          <div class="quick-stats">
            <div class="stat-item">
              <span class="stat-icon" v-html="icons.diamond"></span>
              <span class="stat-value">{{ formatPoints(userInfo?.points || 0) }}</span>
              <span class="stat-label">永久积分</span>
            </div>
            <div class="stat-item">
              <span class="stat-icon" v-html="icons.star"></span>
              <span class="stat-value">{{ formatPoints(userInfo?.package_points || 0) }}</span>
              <span class="stat-label">套餐积分</span>
            </div>
            <div class="stat-item">
              <span class="stat-icon" v-html="icons.coin"></span>
              <span class="stat-value">¥{{ formatBalance(userInfo?.balance || 0) }}</span>
              <span class="stat-label">余额</span>
            </div>
          </div>

          <!-- 导航菜单 -->
          <nav class="panel-nav">
            <button 
              v-for="item in menuItems" 
              :key="item.id"
              :class="['nav-item', { active: activeMenu === item.id }]"
              @click="activeMenu = item.id"
            >
              <span class="nav-icon" v-html="icons[item.icon]"></span>
              <span class="nav-label">{{ item.label }}</span>
            </button>
          </nav>

          <!-- 内容区域 -->
          <div class="panel-content">
            <!-- 个人主页 -->
            <div v-if="activeMenu === 'home'" class="content-section">
              <!-- 签到卡片 -->
              <div class="checkin-card">
                <div class="checkin-info">
                  <span class="checkin-days">连续签到 {{ checkinStatus.consecutiveDays }} 天</span>
                </div>
                <button 
                  class="checkin-btn"
                  :class="{ disabled: checkinStatus.hasCheckedInToday }"
                  :disabled="checkinStatus.hasCheckedInToday"
                  @click="performCheckin"
                >
                  {{ checkinStatus.hasCheckedInToday ? '✓ 已签到' : '签到领积分' }}
                </button>
              </div>

              <!-- 快捷操作 -->
              <div class="quick-actions">
                <button class="action-btn primary" @click="activeMenu = 'packages'">
                  <span class="action-icon" v-html="icons.package"></span>
                  <span>购买套餐</span>
                </button>
                <button class="action-btn" @click="activeMenu = 'voucher'">
                  <span class="action-icon" v-html="icons.ticket"></span>
                  <span>兑换</span>
                </button>
                <button class="action-btn" @click="openRechargePanel">
                  <span class="action-icon" v-html="icons.credit"></span>
                  <span>充值</span>
                </button>
                <button class="action-btn" @click="activeMenu = 'invite'">
                  <span class="action-icon" v-html="icons.gift"></span>
                  <span>邀请</span>
                </button>
              </div>

              <!-- 套餐状态 -->
              <div v-if="userInfo?.package_points > 0" class="package-status">
                <div class="package-badge">VIP</div>
                <div class="package-info">
                  <span>套餐积分 {{ formatPoints(userInfo.package_points) }}</span>
                  <span class="expire-hint">{{ formatExpireTime(userInfo.package_points_expires_at) }}</span>
                </div>
              </div>
            </div>

            <!-- 账户管理 -->
            <div v-else-if="activeMenu === 'profile'" class="content-section">
              <h4 class="section-title">基本资料</h4>
              <div class="form-group">
                <label>用户名</label>
                <input v-model="profileForm.username" type="text" placeholder="输入用户名" maxlength="30" />
              </div>
              <div class="form-group">
                <label>邮箱</label>
                <input v-model="profileForm.email" type="email" placeholder="输入邮箱" />
              </div>
              <div class="form-group">
                <label>简介</label>
                <textarea v-model="profileForm.bio" placeholder="一句话介绍自己" maxlength="200" rows="2"></textarea>
              </div>
              <button class="btn-primary" @click="saveProfile" :disabled="saveLoading">
                {{ saveLoading ? '保存中...' : '保存资料' }}
              </button>

              <h4 class="section-title" style="margin-top: 24px;">修改密码</h4>
              <div class="form-group">
                <label>原密码</label>
                <input v-model="passwordForm.oldPassword" type="password" placeholder="输入原密码" />
              </div>
              <div class="form-group">
                <label>新密码</label>
                <input v-model="passwordForm.newPassword" type="password" placeholder="输入新密码" />
              </div>
              <div class="form-group">
                <label>确认密码</label>
                <input v-model="passwordForm.confirmPassword" type="password" placeholder="确认新密码" />
              </div>
              <button class="btn-primary" @click="changePassword" :disabled="saveLoading">
                修改密码
              </button>
            </div>

            <!-- 订阅套餐 -->
            <div v-else-if="activeMenu === 'packages'" class="content-section">
              <div v-if="packages.length === 0" class="empty-hint">暂无可用套餐</div>
              <div v-else class="packages-list">
                <div 
                  v-for="pkg in packages" 
                  :key="pkg.id"
                  :class="['package-card', { popular: pkg.popular }]"
                >
                  <div class="package-header">
                    <span class="package-name">{{ pkg.name }}</span>
                    <span v-if="pkg.popular" class="popular-badge">推荐</span>
                  </div>
                  <div class="package-price">
                    <span class="price">¥{{ (pkg.price / 100).toFixed(0) }}</span>
                    <span class="unit">/{{ pkg.duration_days }}天</span>
                  </div>
                  <div class="package-points">{{ pkg.points }} 积分</div>
                  <button class="btn-purchase" @click="purchasePackage(pkg)">
                    购买
                  </button>
                </div>
              </div>
            </div>

            <!-- 积分管理 -->
            <div v-else-if="activeMenu === 'points'" class="content-section">
              <!-- 余额划转 -->
              <div class="transfer-section">
                <h4 class="section-title">余额划转积分</h4>
                <p class="transfer-hint">汇率：1元 = {{ exchangeRate }} 永久积分</p>
                <div class="transfer-form">
                  <input 
                    v-model="transferAmount" 
                    type="number" 
                    placeholder="输入金额（元）" 
                    min="1"
                  />
                  <button class="btn-primary" @click="submitTransfer" :disabled="transferLoading">
                    {{ transferLoading ? '划转中...' : '确认划转' }}
                  </button>
                </div>
              </div>

              <h4 class="section-title">积分记录</h4>
              <div v-if="!Array.isArray(ledger) || ledger.length === 0" class="empty-hint">暂无记录</div>
              <div v-else class="ledger-list">
                <div v-for="item in (Array.isArray(ledger) ? ledger : []).slice(0, 20)" :key="item.id" class="ledger-item">
                  <span class="ledger-icon" v-html="icons[getLedgerIconType(item.type)]"></span>
                  <div class="ledger-info">
                    <span class="ledger-type">{{ getLedgerTypeText(item.type) }}</span>
                    <span class="ledger-time">{{ formatTime(item.ts) }}</span>
                  </div>
                  <span :class="['ledger-amount', item.value > 0 ? 'positive' : 'negative']">
                    {{ item.value > 0 ? '+' : '' }}{{ formatPoints(item.value) }}
                  </span>
                </div>
              </div>
            </div>

            <!-- 兑换中心 -->
            <div v-else-if="activeMenu === 'voucher'" class="content-section">
              <h4 class="section-title">兑换码兑换</h4>
              <div class="voucher-form">
                <input 
                  v-model="voucherCode" 
                  type="text" 
                  placeholder="请输入兑换码"
                  @keyup.enter="redeemVoucher"
                />
                <button class="btn-primary" @click="redeemVoucher" :disabled="voucherLoading">
                  {{ voucherLoading ? '兑换中...' : '立即兑换' }}
                </button>
              </div>
              <div v-if="voucherError" class="msg-error">{{ voucherError }}</div>
              <div v-if="voucherSuccess" class="msg-success">{{ voucherSuccess }}</div>

              <div class="voucher-tips">
                <h5>兑换说明</h5>
                <ul>
                  <li>兑换码区分大小写，请准确输入</li>
                  <li>每个兑换码只能使用一次</li>
                  <li>兑换成功后积分立即到账</li>
                </ul>
              </div>
            </div>

            <!-- 邀请奖励 -->
            <div v-else-if="activeMenu === 'invite'" class="content-section">
              <div class="invite-card">
                <h4>我的邀请码</h4>
                <div class="invite-code">{{ invite.invite_code || '加载中...' }}</div>
                <div class="invite-actions">
                  <button class="btn-copy" @click="copyInviteCode">
                    <span class="btn-icon" v-html="icons.copy"></span>
                    <span>复制邀请码</span>
                  </button>
                  <button class="btn-copy" @click="copyInviteLink">
                    <span class="btn-icon" v-html="icons.link"></span>
                    <span>复制链接</span>
                  </button>
                </div>
              </div>

              <div class="invite-stats">
                <div class="stat">
                  <span class="stat-num">{{ invite.uses?.length || 0 }}</span>
                  <span class="stat-label">已邀请</span>
                </div>
                <div class="stat">
                  <span class="stat-num">{{ (invite.uses?.length || 0) * 10 }}</span>
                  <span class="stat-label">获得积分</span>
                </div>
              </div>

              <div class="invite-tips">
                <h5>邀请规则</h5>
                <ul>
                  <li>每邀请一位好友注册，您获得 10 积分</li>
                  <li>被邀请人也可获得 5 积分奖励</li>
                  <li>邀请越多，奖励越多</li>
                </ul>
              </div>
            </div>

            <!-- 使用教程 -->
            <div v-else-if="activeMenu === 'help'" class="content-section">
              <div class="help-list">
                <div class="help-item" @click="goToHelp">
                  <span class="help-icon" v-html="icons.book"></span>
                  <span class="help-text">快速入门指南</span>
                  <span class="help-arrow">→</span>
                </div>
                <div class="help-item">
                  <span class="help-icon" v-html="icons.brush"></span>
                  <span class="help-text">画布操作教程</span>
                  <span class="help-arrow">→</span>
                </div>
                <div class="help-item">
                  <span class="help-icon" v-html="icons.diamond"></span>
                  <span class="help-text">AI生成技巧</span>
                  <span class="help-arrow">→</span>
                </div>
                <div class="help-item">
                  <span class="help-icon" v-html="icons.message"></span>
                  <span class="help-text">联系客服</span>
                  <span class="help-arrow">→</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 底部操作 -->
          <div class="panel-footer">
            <button class="logout-btn" @click="logout">
              <span class="logout-icon" v-html="icons.logout"></span>
              <span>退出登录</span>
            </button>
          </div>

          <!-- 充值面板 -->
          <div v-if="showRechargePanel" class="recharge-panel">
            <div class="recharge-header">
              <h4>账户充值</h4>
              <button class="close-btn" @click="showRechargePanel = false">×</button>
            </div>
            
            <!-- 快捷金额 -->
            <div class="form-section">
              <label class="form-label">选择金额</label>
              <div class="recharge-amounts">
                <button 
                  v-for="amount in quickAmounts" 
                  :key="amount"
                  :class="['amount-btn', { active: rechargeAmount === amount }]"
                  @click="rechargeAmount = amount; rechargeCustomAmount = ''"
                >
                  ¥{{ (amount / 100).toFixed(0) }}
                </button>
              </div>
            </div>
            
            <!-- 自定义金额 -->
            <div class="form-section">
              <label class="form-label">或输入自定义金额（元）</label>
              <input 
                v-model="rechargeCustomAmount" 
                type="number" 
                class="form-input"
                placeholder="1-1500"
                min="1"
                max="1500"
                step="1"
                @input="rechargeAmount = 0"
              />
            </div>
            
            <!-- 支付方式选择 -->
            <div v-if="paymentMethods.length > 0" class="form-section">
              <label class="form-label">支付方式</label>
              <select v-model="rechargeSelectedMethod" class="form-select">
                <option v-for="method in paymentMethods" :key="method.id" :value="method.id">
                  {{ method.name }}
                </option>
              </select>
            </div>
            
            <!-- 优惠券输入 -->
            <div class="form-section">
              <label class="form-label">优惠券码（可选）</label>
              <div class="coupon-input-group">
                <input 
                  v-model="rechargeCouponCode" 
                  type="text" 
                  class="form-input"
                  placeholder="请输入优惠券码"
                  :disabled="!!appliedRechargeCoupon"
                  @input="rechargeCouponCode = rechargeCouponCode.toUpperCase()"
                />
                <button 
                  v-if="!appliedRechargeCoupon"
                  class="btn-apply-coupon" 
                  @click="applyRechargeCoupon"
                  :disabled="!rechargeCouponCode.trim()"
                >
                  应用
                </button>
                <button 
                  v-else
                  class="btn-remove-coupon" 
                  @click="removeRechargeCoupon"
                >
                  移除
                </button>
              </div>
              <div v-if="rechargeCouponError" class="msg-error">{{ rechargeCouponError }}</div>
              <div v-if="appliedRechargeCoupon" class="msg-success">
                ✓ 优惠券已应用，可减免 ¥{{ (rechargeCouponDiscount / 100).toFixed(2) }}
              </div>
            </div>
            
            <!-- 价格信息 -->
            <div v-if="getFinalRechargeAmount() > 0" class="price-info">
              <div class="price-row">
                <span>充值金额</span>
                <span>¥{{ (getFinalRechargeAmount() / 100).toFixed(2) }}</span>
              </div>
              <div v-if="appliedRechargeCoupon && rechargeCouponDiscount > 0" class="price-row discount">
                <span>优惠券减免</span>
                <span>-¥{{ (rechargeCouponDiscount / 100).toFixed(2) }}</span>
              </div>
              <div class="price-row total">
                <span>实付金额</span>
                <span class="total-price">
                  ¥{{ ((getFinalRechargeAmount() - rechargeCouponDiscount) / 100).toFixed(2) }}
                </span>
              </div>
            </div>
            
            <!-- 错误提示 -->
            <div v-if="rechargeError" class="msg-error">{{ rechargeError }}</div>
            
            <!-- 提交按钮 -->
            <button 
              class="btn-primary full-width" 
              @click="submitRecharge" 
              :disabled="rechargeLoading || getFinalRechargeAmount() < 100"
            >
              {{ rechargeLoading ? '处理中...' : '确认充值' }}
            </button>
          </div>

          <!-- 自定义对话框 -->
          <Transition name="dialog">
            <div v-if="dialog.visible" class="custom-dialog-overlay" @click.self="dialog.type === 'confirm' && dialog.onCancel?.()">
              <div class="custom-dialog">
                <div class="dialog-header">
                  <h4 class="dialog-title">{{ dialog.title }}</h4>
                </div>
                <div class="dialog-body">
                  <p class="dialog-message">{{ dialog.message }}</p>
                </div>
                <div class="dialog-footer">
                  <button 
                    v-if="dialog.type === 'confirm'" 
                    class="dialog-btn cancel" 
                    @click="dialog.onCancel?.()"
                  >
                    {{ dialog.cancelText }}
                  </button>
                  <button 
                    class="dialog-btn confirm" 
                    @click="dialog.onConfirm?.()"
                  >
                    {{ dialog.confirmText }}
                  </button>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* 遮罩层 */
.profile-panel-overlay {
  position: fixed;
  inset: 0;
  z-index: 9998;
}

/* 面板主体 */
.profile-panel {
  position: fixed;
  width: 380px;
  max-height: calc(100vh - 120px);
  background: rgba(26, 26, 26, 0.98);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 头部 */
.panel-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.user-avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  flex-shrink: 0;
}

.user-info {
  flex: 1;
  min-width: 0;
}

.user-name {
  margin: 0 0 4px 0;
  font-size: 18px;
  font-weight: 600;
  color: #fff;
}

.user-email {
  margin: 0;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.close-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.6);
  font-size: 20px;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
}

/* 快捷数据 */
.quick-stats {
  display: flex;
  gap: 8px;
  padding: 16px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.stat-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 8px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
}

.stat-icon {
  width: 20px;
  height: 20px;
  color: rgba(255, 255, 255, 0.6);
}

.stat-icon :deep(svg) {
  width: 100%;
  height: 100%;
}

.stat-value {
  font-size: 16px;
  font-weight: 700;
  color: #fff;
}

.stat-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
}

/* 导航菜单 */
.panel-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border: 1px solid transparent;
  background: transparent;
  color: rgba(255, 255, 255, 0.55);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 13px;
  font-weight: 450;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.85);
}

.nav-item.active {
  background: rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.nav-icon {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nav-icon :deep(svg) {
  width: 100%;
  height: 100%;
}

/* 内容区域 */
.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
}

.content-section {
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.section-title {
  margin: 0 0 16px 0;
  font-size: 14px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.5);
}

/* 签到卡片 */
.checkin-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  margin-bottom: 20px;
}

.checkin-days {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.85);
}

.checkin-btn {
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.9);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.checkin-btn:hover:not(.disabled) {
  background: rgba(255, 255, 255, 0.22);
  border-color: rgba(255, 255, 255, 0.35);
}

.checkin-btn.disabled {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.4);
  cursor: not-allowed;
}

/* 快捷操作 */
.quick-actions {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 20px;
}

.action-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px 8px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  transition: all 0.2s;
  font-size: 12px;
}

.action-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
}

.action-btn.primary {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.25);
  color: rgba(255, 255, 255, 0.95);
}

.action-btn.primary:hover {
  background: rgba(255, 255, 255, 0.22);
  border-color: rgba(255, 255, 255, 0.35);
}

.action-icon {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-icon :deep(svg) {
  width: 100%;
  height: 100%;
}

/* 套餐状态 */
.package-status {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
}

.package-badge {
  padding: 4px 10px;
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 6px;
  font-size: 12px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.9);
}

.package-info {
  display: flex;
  flex-direction: column;
  font-size: 13px;
  color: #fff;
}

.expire-hint {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
}

/* 表单 */
.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 12px 14px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  color: #fff;
  font-size: 14px;
  transition: all 0.2s;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #667eea;
  background: rgba(102, 126, 234, 0.1);
}

.form-group textarea {
  resize: none;
}

/* 按钮 */
.btn-primary {
  padding: 12px 24px;
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 10px;
  color: rgba(255, 255, 255, 0.95);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.22);
  border-color: rgba(255, 255, 255, 0.35);
}

.btn-primary:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-primary.full-width {
  width: 100%;
}

/* 套餐列表 */
.packages-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.package-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  transition: all 0.2s;
}

.package-card:hover {
  border-color: rgba(255, 255, 255, 0.2);
}

.package-card.popular {
  border-color: rgba(102, 126, 234, 0.5);
  background: rgba(102, 126, 234, 0.1);
}

.package-header {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
}

.package-name {
  font-size: 15px;
  font-weight: 600;
  color: #fff;
}

.popular-badge {
  padding: 2px 8px;
  background: #667eea;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 700;
  color: white;
}

.package-price {
  text-align: right;
}

.package-price .price {
  font-size: 18px;
  font-weight: 700;
  color: #fff;
}

.package-price .unit {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

.package-points {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
}

.btn-purchase {
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  color: #fff;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-purchase:hover {
  background: #667eea;
  border-color: #667eea;
}

/* 余额划转 */
.transfer-section {
  margin-bottom: 24px;
  padding-bottom: 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.transfer-hint {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 12px;
}

.transfer-form {
  display: flex;
  gap: 12px;
}

.transfer-form input {
  flex: 1;
  padding: 12px 14px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  color: #fff;
  font-size: 14px;
}

.transfer-form input:focus {
  outline: none;
  border-color: #667eea;
}

/* 积分记录 */
.ledger-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ledger-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 10px;
}

.ledger-icon {
  width: 20px;
  height: 20px;
  color: rgba(255, 255, 255, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
}

.ledger-icon :deep(svg) {
  width: 100%;
  height: 100%;
}

.ledger-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ledger-type {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
}

.ledger-time {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
}

.ledger-amount {
  font-size: 15px;
  font-weight: 600;
}

.ledger-amount.positive {
  color: #10b981;
}

.ledger-amount.negative {
  color: #ef4444;
}

/* 兑换表单 */
.voucher-form {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.voucher-form input {
  flex: 1;
  padding: 12px 14px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  color: #fff;
  font-size: 14px;
}

.voucher-form input:focus {
  outline: none;
  border-color: #667eea;
}

.msg-error {
  padding: 10px 14px;
  background: rgba(239, 68, 68, 0.2);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 8px;
  color: #ef4444;
  font-size: 13px;
  margin-bottom: 16px;
}

.msg-success {
  padding: 10px 14px;
  background: rgba(16, 185, 129, 0.2);
  border: 1px solid rgba(16, 185, 129, 0.3);
  border-radius: 8px;
  color: #10b981;
  font-size: 13px;
  margin-bottom: 16px;
}

.voucher-tips, .invite-tips {
  padding: 16px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 12px;
  margin-top: 16px;
}

.voucher-tips h5, .invite-tips h5 {
  margin: 0 0 12px 0;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
}

.voucher-tips ul, .invite-tips ul {
  margin: 0;
  padding: 0 0 0 16px;
}

.voucher-tips li, .invite-tips li {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  line-height: 1.8;
}

/* 邀请卡片 */
.invite-card {
  padding: 20px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 16px;
  text-align: center;
  margin-bottom: 20px;
}

.invite-card h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
}

.invite-code {
  padding: 12px 20px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 10px;
  font-family: monospace;
  font-size: 20px;
  font-weight: 700;
  color: #fff;
  letter-spacing: 2px;
  margin-bottom: 16px;
}

.invite-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.btn-copy {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  color: #fff;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-copy:hover {
  background: rgba(255, 255, 255, 0.15);
}

.btn-icon {
  width: 14px;
  height: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-icon :deep(svg) {
  width: 100%;
  height: 100%;
}

.invite-stats {
  display: flex;
  gap: 24px;
  justify-content: center;
  margin-bottom: 20px;
}

.invite-stats .stat {
  text-align: center;
}

.invite-stats .stat-num {
  display: block;
  font-size: 28px;
  font-weight: 700;
  color: #fff;
}

.invite-stats .stat-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

/* 帮助列表 */
.help-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.help-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.help-item:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.15);
}

.help-icon {
  width: 22px;
  height: 22px;
  color: rgba(255, 255, 255, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
}

.help-icon :deep(svg) {
  width: 100%;
  height: 100%;
}

.help-text {
  flex: 1;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.8);
}

.help-arrow {
  font-size: 16px;
  color: rgba(255, 255, 255, 0.4);
}

/* 空提示 */
.empty-hint {
  text-align: center;
  padding: 40px 20px;
  color: rgba(255, 255, 255, 0.4);
  font-size: 14px;
}

/* 底部 */
.panel-footer {
  padding: 16px 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.logout-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  color: rgba(255, 255, 255, 0.6);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.logout-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.85);
  border-color: rgba(255, 255, 255, 0.2);
}

.logout-icon {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.logout-icon :deep(svg) {
  width: 100%;
  height: 100%;
}

/* 充值面板 */
.recharge-panel {
  position: absolute;
  inset: 0;
  background: rgba(26, 26, 26, 0.98);
  border-radius: 20px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.recharge-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.recharge-header h4 {
  margin: 0;
  font-size: 18px;
  color: #fff;
}

.recharge-amounts {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.amount-btn {
  padding: 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.amount-btn:hover {
  border-color: rgba(255, 255, 255, 0.2);
}

.amount-btn.active {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.4);
  color: rgba(255, 255, 255, 0.95);
}

/* 充值表单 */
.form-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
  font-weight: 500;
}

.form-input,
.form-select {
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: #fff;
  font-size: 14px;
  transition: all 0.2s;
}

.form-input:focus,
.form-select:focus {
  outline: none;
  border-color: rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.08);
}

.form-input::placeholder {
  color: rgba(255, 255, 255, 0.3);
}

.form-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.form-select {
  cursor: pointer;
}

/* 优惠券输入组 */
.coupon-input-group {
  display: flex;
  gap: 8px;
}

.coupon-input-group .form-input {
  flex: 1;
}

.btn-apply-coupon,
.btn-remove-coupon {
  padding: 12px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn-apply-coupon {
  background: rgba(59, 130, 246, 0.9);
  color: #fff;
}

.btn-apply-coupon:hover:not(:disabled) {
  background: rgba(59, 130, 246, 1);
}

.btn-apply-coupon:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-remove-coupon {
  background: rgba(239, 68, 68, 0.9);
  color: #fff;
}

.btn-remove-coupon:hover {
  background: rgba(239, 68, 68, 1);
}

/* 价格信息 */
.price-info {
  padding: 16px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.price-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
}

.price-row.discount {
  color: rgba(34, 197, 94, 0.9);
}

.price-row.total {
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 16px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.95);
}

.total-price {
  font-size: 18px;
  color: rgba(251, 191, 36, 0.95);
}

/* 消息提示 */
.msg-error {
  padding: 10px 12px;
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 6px;
  color: rgba(239, 68, 68, 0.95);
  font-size: 13px;
}

.msg-success {
  padding: 10px 12px;
  background: rgba(34, 197, 94, 0.15);
  border: 1px solid rgba(34, 197, 94, 0.3);
  border-radius: 6px;
  color: rgba(34, 197, 94, 0.95);
  font-size: 13px;
}

/* 动画 */
.panel-enter-active,
.panel-leave-active {
  transition: all 0.3s ease;
}

.panel-enter-from,
.panel-leave-to {
  opacity: 0;
}

.panel-enter-from .profile-panel,
.panel-leave-to .profile-panel {
  transform: translateX(-20px);
  opacity: 0;
}

/* 自定义对话框 */
.custom-dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.custom-dialog {
  width: 320px;
  background: rgba(32, 32, 32, 0.98);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}

.dialog-header {
  padding: 20px 24px 0;
}

.dialog-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.95);
  text-align: center;
}

.dialog-body {
  padding: 16px 24px 24px;
}

.dialog-message {
  margin: 0;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
  text-align: center;
  line-height: 1.6;
  white-space: pre-line;
}

.dialog-footer {
  display: flex;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.dialog-btn {
  flex: 1;
  padding: 14px;
  border: none;
  background: transparent;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.dialog-btn.cancel {
  color: rgba(255, 255, 255, 0.6);
  border-right: 1px solid rgba(255, 255, 255, 0.1);
}

.dialog-btn.cancel:hover {
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.8);
}

.dialog-btn.confirm {
  color: rgba(255, 255, 255, 0.95);
}

.dialog-btn.confirm:hover {
  background: rgba(255, 255, 255, 0.1);
}

/* 对话框动画 */
.dialog-enter-active,
.dialog-leave-active {
  transition: all 0.2s ease;
}

.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;
}

.dialog-enter-from .custom-dialog,
.dialog-leave-to .custom-dialog {
  transform: scale(0.9);
  opacity: 0;
}
</style>

