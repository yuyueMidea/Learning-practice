<template>
  <aside class="app-sidebar" :class="{ 'is-collapsed': appStore.sidebarCollapsed }">
    <div class="app-sidebar__brand">
      <div class="app-sidebar__logo">E</div>
      <span v-show="!appStore.sidebarCollapsed" class="app-sidebar__title">{{ appStore.title }}</span>
    </div>

    <el-scrollbar class="app-sidebar__scrollbar">
      <el-menu
        :default-active="activePath"
        :collapse="appStore.sidebarCollapsed"
        :collapse-transition="false"
        :unique-opened="false"
        background-color="transparent"
        text-color="rgba(255,255,255,0.78)"
        active-text-color="#ffffff"
        @select="handleSelect"
      >
        <MenuNode v-for="menu in appStore.visibleMenuTree" :key="menu.id" :menu="menu" />
      </el-menu>
    </el-scrollbar>
  </aside>
</template>

<script setup>
import { computed, defineComponent, h, resolveDynamicComponent } from 'vue'
import { ElIcon, ElMenuItem, ElSubMenu } from 'element-plus'
import { Menu as MenuIcon } from '@element-plus/icons-vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'

const appStore = useAppStore()
const route = useRoute()
const router = useRouter()
const activePath = computed(() => route.meta?.menuCode === 'dashboard' ? '/dashboard' : route.path)

const MenuNode = defineComponent({
  name: 'MenuNode',
  props: {
    menu: {
      type: Object,
      required: true
    }
  },
  setup(props) {
    const renderIcon = () => h(resolveDynamicComponent(props.menu.icon || MenuIcon))

    return () => {
      const children = (props.menu.children || []).filter((item) => item.menu_type !== 'button')
      if (children.length) {
        return h(
          ElSubMenu,
          { index: props.menu.code },
          {
            title: () => [h(ElIcon, null, { default: renderIcon }), h('span', null, props.menu.name)],
            default: () => children.map((child) => h(MenuNode, { key: child.id, menu: child }))
          }
        )
      }

      if (!props.menu.route_path || props.menu.menu_type === 'button') return null

      return h(
        ElMenuItem,
        { index: props.menu.route_path },
        {
          default: () => [h(ElIcon, null, { default: renderIcon }), h('span', null, props.menu.name)]
        }
      )
    }
  }
})

function handleSelect(path) {
  if (path && path !== route.path) router.push(path)
}
</script>
