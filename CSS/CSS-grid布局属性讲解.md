一个 **非常典型的后台管理系统布局**，用 **CSS Grid（网格布局）**实现非常合适，比 `flex` 更清晰。

先 **解析布局结构 → 再讲 Grid 核心属性 → 最后给完整代码**。

---

# 一、先理解这张布局图

![Image](https://cdn.dribbble.com/userupload/39780468/file/original-bc19305fc6efddd9498c1def67ceaf67.png?resize=1600x1200)

![Image](https://patrickbrosset.com/assets/grid/grid3.png)

![Image](https://i.sstatic.net/eSSfS.png)

![Image](https://docs.murasoftware.com/sites/v7-1/assets/Image/back-end-guide/tabs-1.jpg)

整体结构其实是 **两层 Grid**。

## 第一层：整体布局

```
┌───────────────────────────┐
│          header           │
├───────────────┬───────────┤
│               │           │
│     aside     │   main    │
│               │           │
│               │           │
└───────────────┴───────────┘
```

特点：

* header：固定高度
* aside：左侧菜单
* main：右侧主区域

---

## 第二层：main内部

```
┌───────────────────┐
│        tab        │
├───────────────────┤
│                   │
│       main        │
│                   │
└───────────────────┘
```

特点：

* tab：顶部标签栏
* main：页面内容区

---

# 二、CSS Grid 核心知识点

## 1 `display: grid`

开启网格布局

```css
.container {
  display: grid;
}
```

---

## 2 `grid-template-columns`

定义 **列结构**

例如：

```
左侧菜单 + 主区域
```

```css
grid-template-columns: 240px 1fr;
```

含义：

```
240px | 剩余空间
```

`1fr` = 剩余空间比例单位。

---

## 3 `grid-template-rows`

定义 **行结构**

```css
grid-template-rows: 60px 1fr;
```

含义：

```
header
content
```

---

## 4 `grid-template-areas`

Grid 最强大的地方。

可以用 **区域命名布局**。

例如：

```css
grid-template-areas:
  "header header"
  "aside  main";
```

对应：

```
header header
aside  main
```

---

# 三、管理系统布局实现（推荐写法）

## HTML结构

```html
<div class="layout">

  <header class="header">header</header>

  <aside class="aside">aside</aside>

  <div class="content">

      <div class="tab">tab</div>

      <main class="main">main</main>

  </div>

</div>
```

---

# 四、第一层 Grid（整体布局）

```css
.layout {

  display: grid;

  height: 100vh;

  grid-template-columns: 220px 1fr;

  grid-template-rows: 60px 1fr;

  grid-template-areas:
    "header header"
    "aside content";

}
```

---

## 区域绑定

```css
.header {
  grid-area: header;
}

.aside {
  grid-area: aside;
}

.content {
  grid-area: content;
}
```

---

# 五、第二层 Grid（main区域）

content 里面再做一层 grid。

```css
.content {

  display: grid;

  grid-template-rows: 40px 1fr;

}
```

结构：

```
tab
main
```

---

```css
.tab {
  background: #f5f5f5;
}

.main {
  overflow: auto;
}
```

---

# 六、完整示例代码（可直接运行）

```html
<style>

body{
  margin:0;
}

.layout{

  display:grid;

  height:100vh;

  grid-template-columns:220px 1fr;

  grid-template-rows:60px 1fr;

  grid-template-areas:
  "header header"
  "aside content";

}

.header{

  grid-area:header;

  background:#333;

  color:white;

  display:flex;

  align-items:center;

  padding-left:20px;

}

.aside{

  grid-area:aside;

  background:#444;

  color:white;

}

.content{

  grid-area:content;

  display:grid;

  grid-template-rows:40px 1fr;

}

.tab{

  background:#ddd;

  display:flex;

  align-items:center;

  padding-left:10px;

}

.main{

  background:#fafafa;

  padding:20px;

}

</style>


<div class="layout">

<header class="header">Header</header>

<aside class="aside">Aside Menu</aside>

<div class="content">

<div class="tab">Tab Bar</div>

<main class="main">Main Content</main>

</div>

</div>
```

---

# 七、Grid 关键属性总结（开发者必会）

| 属性                    | 作用       |
| --------------------- | -------- |
| display:grid          | 开启grid布局 |
| grid-template-columns | 定义列      |
| grid-template-rows    | 定义行      |
| grid-template-areas   | 区域布局     |
| grid-area             | 绑定区域     |
| gap                   | 行列间距     |
| justify-items         | 水平对齐     |
| align-items           | 垂直对齐     |

---

# 八、管理系统为什么推荐 Grid

对于 **后台系统布局**：

Grid 优势：

1️⃣ 布局表达非常直观

```
"header header"
"aside  main"
```

2️⃣ 不需要 float / flex hack

3️⃣ 二维布局能力强

4️⃣ 代码可读性极高

---

# 九、真实企业后台布局（进阶版）

实际项目一般是：

```
header
---------------------------------
aside | tab
aside | breadcrumb
aside | page content
```

Grid写法：

```
"header header"
"aside tab"
"aside main"
```
