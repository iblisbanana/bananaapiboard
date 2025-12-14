import { createRouter, createWebHistory } from 'vue-router'
import Home from '@/views/Home.vue'
import User from '@/views/User.vue'
import Packages from '@/views/Packages.vue'
import VideoGeneration from '@/views/VideoGeneration.vue'
import AdminBoard from '@/views/AdminBoard.vue'
import Canvas from '@/views/Canvas.vue'
import WorkflowList from '@/views/WorkflowList.vue'
import Landing3D from '@/views/Landing3D.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { 
      path: '/', 
      name: 'landing',
      component: Landing3D,
      meta: { title: 'AI Design Unleashed' }
    },
    { 
      path: '/generate', 
      name: 'home',
      component: Home,
      meta: { title: '图片生成' }
    },
    {
      path: '/canvas',
      name: 'canvas',
      component: Canvas,
      meta: { title: '创作画布' }
    },
    {
      path: '/workflows',
      name: 'workflows',
      component: WorkflowList,
      meta: { title: '工作流列表' }
    },
    { 
      path: '/video', 
      name: 'video',
      component: VideoGeneration,
      meta: { title: '视频生成' }
    },
    // /auth 路由已移除，登录统一从落地页进入
    { 
      path: '/auth', 
      redirect: '/'
    },
    { 
      path: '/user', 
      name: 'user',
      component: User,
      meta: { title: '用户中心' }
    },
    { 
      path: '/packages', 
      name: 'packages',
      component: Packages,
      meta: { title: '套餐购买' }
    },
    { 
      path: '/adminboard', 
      name: 'adminboard',
      component: AdminBoard,
      meta: { title: '管理后台' }
    },
    // 404 重定向到首页
    {
      path: '/:pathMatch(.*)*',
      redirect: '/'
    }
  ]
})

// 路由守卫 - 更新页面标题
router.beforeEach((to, from, next) => {
  document.title = to.meta.title ? `${to.meta.title} - AI创作平台` : 'AI创作平台'
  next()
})

export default router




