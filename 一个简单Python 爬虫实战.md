给一套**可以落地跑通的完整项目（工程级简化版）**，照着一步步做就能跑起来。

---

# 🚀 项目目标（你将得到什么）

实现一个完整链路：

```text
网站（动态） → Playwright 抓取 → 解析数据 → SQLite 存储 → Flask API 输出
```

---

# 🧩 一、抓取目标选择（真实网站）

我们选一个**合法、公开、适合练手**的站点：

👉 [https://quotes.toscrape.com/js/](https://quotes.toscrape.com/js/)

特点：

* JS 渲染（必须用 Playwright）
* 无登录
* 无强反爬（适合入门）
* 数据结构清晰（名言、作者）

---

# 🏗 二、项目结构（直接照这个建）

```bash
crawler-project/
├── main.py              # 入口
├── crawler/
│   └── spider.py        # 爬虫逻辑
├── parser/
│   └── parse.py         # 数据解析
├── storage/
│   └── db.py            # SQLite
├── api/
│   └── app.py           # Flask API
├── data/
│   └── quotes.db
└── requirements.txt
```

---

# 📦 三、安装依赖

```bash
pip install playwright flask sqlite3
playwright install
```

---

# 🕷 四、爬虫实现（Playwright）

## 📄 crawler/spider.py

```python
from playwright.sync_api import sync_playwright
from parser.parse import parse_quotes

def fetch_quotes():
    results = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        url = "https://quotes.toscrape.com/js/"
        page.goto(url)

        # 等待页面加载
        page.wait_for_selector(".quote")

        content = page.content()

        results = parse_quotes(content)

        browser.close()

    return results
```

---

# 🧠 五、解析数据

## 📄 parser/parse.py

```python
from bs4 import BeautifulSoup

def parse_quotes(html):
    soup = BeautifulSoup(html, "html.parser")
    data = []

    quotes = soup.select(".quote")

    for q in quotes:
        text = q.select_one(".text").get_text()
        author = q.select_one(".author").get_text()

        data.append({
            "text": text,
            "author": author
        })

    return data
```

---

# 🗄 六、SQLite 存储

## 📄 storage/db.py

```python
import sqlite3

DB_PATH = "data/quotes.db"

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS quotes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        text TEXT,
        author TEXT
    )
    ''')

    conn.commit()
    conn.close()


def insert_quotes(quotes):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    for q in quotes:
        cursor.execute(
            "INSERT INTO quotes (text, author) VALUES (?, ?)",
            (q["text"], q["author"])
        )

    conn.commit()
    conn.close()


def get_all_quotes():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("SELECT id, text, author FROM quotes")
    rows = cursor.fetchall()

    conn.close()

    return [
        {"id": r[0], "text": r[1], "author": r[2]}
        for r in rows
    ]
```

---

# 🚀 七、主程序（串起来）

## 📄 main.py

```python
from crawler.spider import fetch_quotes
from storage.db import init_db, insert_quotes

def run():
    print("初始化数据库...")
    init_db()

    print("开始抓取数据...")
    quotes = fetch_quotes()

    print(f"抓取 {len(quotes)} 条数据")

    print("写入数据库...")
    insert_quotes(quotes)

    print("完成！")

if __name__ == "__main__":
    run()
```

👉 运行：

```bash
python main.py
```

---

# 🌐 八、API 服务（Flask）

## 📄 api/app.py

```python
from flask import Flask, jsonify
from storage.db import get_all_quotes

app = Flask(__name__)

@app.route("/quotes")
def quotes():
    data = get_all_quotes()
    return jsonify(data)

if __name__ == "__main__":
    app.run(debug=True, port=5000)
```

👉 启动：

```bash
python api/app.py
```

浏览器访问：

```bash
http://localhost:5000/quotes
```

---

# 🧪 九、效果

你会得到：

```json
[
  {
    "id": 1,
    "text": "“The world as we have created it...”",
    "author": "Albert Einstein"
  }
]
```

---

# 🛡 十、加一点“反爬意识”（实战要用）

在 spider.py 加一点随机延迟：

```python
import time, random

time.sleep(random.uniform(1, 3))
```

以及 header：

```python
page.set_extra_http_headers({
    "User-Agent": "Mozilla/5.0 ..."
})
```

---

# 🔥 十一、下一步升级路线（重点）

你这套跑通后，可以升级：

---

## 🚀 升级 1：翻页抓取

```python
while True:
    page.click(".next > a")
```

---

## 🚀 升级 2：去重

SQLite 加唯一索引：

```sql
UNIQUE(text)
```

---

## 🚀 升级 3：API 增强

```python
/quotes?page=1&limit=10
```

---

## 🚀 升级 4：变成服务

```bash
定时任务（cron）
```

---

# 🧠 最关键总结（给你一句话）

👉 **现代爬虫核心不是“解析 HTML”，而是：**

```text
Playwright（搞定动态） + SQLite（存数据） + API（输出价值）
```

