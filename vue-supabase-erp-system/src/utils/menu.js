export function normalizeMenuList(menus = []) {
  return (Array.isArray(menus) ? menus : [])
    .filter((menu) => menu && menu.status !== 'inactive')
    .map((menu) => ({
      ...menu,
      children: []
    }))
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name, 'zh-CN'))
}

export function buildMenuTree(menus = []) {
  const normalized = normalizeMenuList(menus)
  const map = new Map(normalized.map((menu) => [menu.id, menu]))
  const roots = []

  normalized.forEach((menu) => {
    if (menu.parent_id && map.has(menu.parent_id)) {
      map.get(menu.parent_id).children.push(menu)
      return
    }
    roots.push(menu)
  })

  return roots
}

export function flattenMenuTree(menus = []) {
  const result = []
  const walk = (items) => {
    items.forEach((item) => {
      result.push(item)
      if (Array.isArray(item.children) && item.children.length) walk(item.children)
    })
  }
  walk(menus)
  return result
}
