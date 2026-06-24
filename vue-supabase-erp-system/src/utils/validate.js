export const REGEX = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^(?:(?:\+|00)86)?1[3-9]\d{9}$/,
  code: /^[A-Za-z0-9_-]+$/
}

export function requiredRule(message = '此项为必填项') {
  return { required: true, message, trigger: ['blur', 'change'] }
}

export function emailRule(message = '请输入正确的邮箱地址') {
  return { type: 'email', message, trigger: ['blur', 'change'] }
}

export function codeRule(message = '仅支持字母、数字、下划线和中划线') {
  return { pattern: REGEX.code, message, trigger: ['blur', 'change'] }
}
