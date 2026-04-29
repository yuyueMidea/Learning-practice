import Mock from 'mockjs'

Mock.setup({ timeout: '200-500' })

// Import all mock modules
import './modules/auth.js'
import './modules/users.js'
import './modules/roles.js'
import './modules/products.js'
import './modules/stock.js'
import './modules/dashboard.js'

export default Mock
