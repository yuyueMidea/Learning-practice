import { reactive, ref, toRaw } from 'vue'

function clone(value) {
  return JSON.parse(JSON.stringify(value || {}))
}

export function useForm(initialValues = {}) {
  const formRef = ref(null)
  const submitting = ref(false)
  const initialState = clone(initialValues)
  const form = reactive(clone(initialValues))

  function setValues(values = {}, resetMissing = false) {
    if (resetMissing) {
      Object.keys(form).forEach((key) => {
        if (!(key in values)) delete form[key]
      })
    }
    Object.assign(form, clone(values))
  }

  function reset(values = initialState) {
    setValues(values, true)
    formRef.value?.clearValidate?.()
  }

  async function validate() {
    if (!formRef.value) return true
    await formRef.value.validate()
    return true
  }

  async function submit(submitAction) {
    if (typeof submitAction !== 'function') {
      throw new Error('useForm.submit 需要传入提交函数')
    }

    await validate()
    submitting.value = true
    try {
      return await submitAction(clone(toRaw(form)))
    } finally {
      submitting.value = false
    }
  }

  return {
    formRef,
    form,
    submitting,
    setValues,
    reset,
    validate,
    submit
  }
}
