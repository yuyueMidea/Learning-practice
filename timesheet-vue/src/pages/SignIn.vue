<template>
  <div>
    <!-- Topbar -->
    <div class="topbar">
      <div class="logo">TS</div>
      <div>
        <div class="product">Timesheet Management System</div>
        <div class="sub">Internal Staff Portal</div>
      </div>
      <div class="spacer" />
      <span class="pill">Static clickable prototype</span>
    </div>

    <!-- Sign-in card -->
    <div class="signin-wrap">
      <div class="signin card">
        <div class="center">
          <div class="brand-mark">TS</div>
          <h1 class="login-title">Timesheet Management System</h1>
          <div class="login-sub">Internal Staff Portal</div>
        </div>

        <div class="field">
          <label>Company Email</label>
          <input class="input" value="chris.wong@company.com" />
        </div>
        <br />
        <div class="field">
          <label>Password</label>
          <input type="password" class="input" value="password" />
        </div>
        <br />
        <label style="font-size: 13px; color: #475467">
          <input type="checkbox" /> Remember me
        </label>
        <br /><br />
        <button
          class="btn primary"
          style="width: 100%; justify-content: center"
          @click="router.push('/timesheet')"
        >
          Sign In
        </button>
        <div class="footer-note">For internal use only · Forgot password?</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
const router = useRouter()
</script>
