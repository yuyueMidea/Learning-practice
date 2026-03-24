下面这套是给你的**《Go 高并发爬虫（带任务调度）实战版》**，我按“新手能跑 + 架构可扩展”的思路来设计，尽量做到：

👉 能直接运行
👉 能理解原理
👉 能往生产级升级

---

# 🚀 一、项目目标（最终效果）

```text
多任务URL → 并发抓取 → 解析数据 → SQLite存储 → 定时调度 → API输出
```

---

# 🧩 二、技术选型（Go版最优组合）

```bash
Go + Colly（爬虫）
Go 协程（并发）
SQLite（存储）
Cron（调度）
Gin（API）
```

---

# 🏗 三、项目结构

```bash
go-crawler/
├── main.go
├── crawler/
│   └── spider.go
├── scheduler/
│   └── cron.go
├── storage/
│   └── db.go
├── api/
│   └── server.go
├── model/
│   └── quote.go
├── go.mod
└── data/
    └── quotes.db
```

---

# 📦 四、安装依赖

```bash
go mod init go-crawler

go get github.com/gocolly/colly
go get github.com/gin-gonic/gin
go get github.com/robfig/cron/v3
go get github.com/mattn/go-sqlite3
```

---

# 🧠 五、数据模型

## 📄 model/quote.go

```go
package model

type Quote struct {
	ID     int
	Text   string
	Author string
}
```

---

# 🗄 六、SQLite 存储层

## 📄 storage/db.go

```go
package storage

import (
	"database/sql"
	"log"

	_ "github.com/mattn/go-sqlite3"
)

var DB *sql.DB

func InitDB() {
	var err error
	DB, err = sql.Open("sqlite3", "data/quotes.db")
	if err != nil {
		log.Fatal(err)
	}

	createTable := `
	CREATE TABLE IF NOT EXISTS quotes (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		text TEXT,
		author TEXT
	);`

	_, err = DB.Exec(createTable)
	if err != nil {
		log.Fatal(err)
	}
}

func InsertQuote(text, author string) {
	stmt, _ := DB.Prepare("INSERT INTO quotes(text, author) VALUES(?, ?)")
	defer stmt.Close()

	stmt.Exec(text, author)
}

func GetQuotes() []map[string]interface{} {
	rows, _ := DB.Query("SELECT id, text, author FROM quotes")

	var result []map[string]interface{}

	for rows.Next() {
		var id int
		var text, author string

		rows.Scan(&id, &text, &author)

		result = append(result, map[string]interface{}{
			"id":     id,
			"text":   text,
			"author": author,
		})
	}

	return result
}
```

---

# 🕷 七、高并发爬虫（核心）

## 📄 crawler/spider.go

```go
package crawler

import (
	"log"
	"sync"

	"github.com/gocolly/colly"
	"go-crawler/storage"
)

func StartCrawler(urls []string) {
	var wg sync.WaitGroup

	// 并发控制
	c := colly.NewCollector(
		colly.Async(true),
	)

	// 限速（反爬）
	c.Limit(&colly.LimitRule{
		DomainGlob:  "*",
		Parallelism: 5, // 并发数
	})

	c.OnHTML(".quote", func(e *colly.HTMLElement) {
		text := e.ChildText(".text")
		author := e.ChildText(".author")

		log.Println("抓取:", text)

		storage.InsertQuote(text, author)
	})

	c.OnRequest(func(r *colly.Request) {
		log.Println("访问:", r.URL)
	})

	for _, url := range urls {
		wg.Add(1)

		go func(u string) {
			defer wg.Done()
			c.Visit(u)
		}(url)
	}

	wg.Wait()
	c.Wait()
}
```

---

# ⏰ 八、任务调度（Cron）

## 📄 scheduler/cron.go

```go
package scheduler

import (
	"log"

	"github.com/robfig/cron/v3"
	"go-crawler/crawler"
)

func StartCron() {
	c := cron.New()

	// 每1分钟执行一次
	c.AddFunc("@every 1m", func() {
		log.Println("定时任务开始...")

		urls := []string{
			"http://quotes.toscrape.com/",
		}

		crawler.StartCrawler(urls)
	})

	c.Start()
}
```

---

# 🌐 九、API 服务（Gin）

## 📄 api/server.go

```go
package api

import (
	"github.com/gin-gonic/gin"
	"go-crawler/storage"
)

func StartServer() {
	r := gin.Default()

	r.GET("/quotes", func(c *gin.Context) {
		data := storage.GetQuotes()
		c.JSON(200, data)
	})

	r.Run(":8080")
}
```

---

# 🚀 十、主程序入口

## 📄 main.go

```go
package main

import (
	"go-crawler/api"
	"go-crawler/scheduler"
	"go-crawler/storage"
)

func main() {
	// 初始化数据库
	storage.InitDB()

	// 启动定时任务
	scheduler.StartCron()

	// 启动API服务
	api.StartServer()
}
```

---

# ▶️ 十一、运行项目

```bash
go run main.go
```

访问：

```bash
http://localhost:8080/quotes
```

---

# ⚡ 十二、关键设计讲解（非常重要）

---

## 1️⃣ 为什么 Go 很适合爬虫？

因为：

```go
goroutine ≈ 超轻量线程
```

👉 一台机器可以跑几千个并发请求

---

## 2️⃣ Colly 的优势

* 自动处理并发
* 支持回调（OnHTML）
* 内置限速

---

## 3️⃣ 调度设计

```text
Cron → 定时触发 → 爬虫 → 入库
```

👉 实际就是一个“数据管道”

---

## 4️⃣ SQLite 的定位

👉 当前阶段：

```text
轻量数据库（单机）
```

👉 后期升级：

```text
MySQL / PostgreSQL
```

---

# 🔥 十三、升级路线（实战进阶）

---

## 🚀 升级 1：URL 队列

```go
channel / Redis 队列
```

---

## 🚀 升级 2：去重

```sql
UNIQUE(text)
```

---

## 🚀 升级 3：分布式

```text
多个爬虫节点 + Redis
```

---

## 🚀 升级 4：反爬增强

* 代理池
* UA池
* Cookie池

---

## 🚀 升级 5：抓动态页面

```bash
chromedp / rod
```

---

# 🧠 十四、给你一条“高手经验”

👉 真正高并发爬虫的核心不是“多线程”，而是：

```text
限速 + 稳定 + 数据质量
```

---

# 🎁 如果你想继续升级（强烈推荐）

我可以帮你再做三套进阶版本：

---

### 👉 1、《Go 分布式爬虫系统（Redis + Worker）》

（真正企业级）

### 👉 2、《反爬对抗实战（验证码 / 指纹 / Cloudflare）》

### 👉 3、《爬虫 + 前端后台（Vue3 + API）》
