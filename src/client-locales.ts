export const en = {
  loading: 'Checking sign-in status…', signedIn: 'Signed in', signedOut: 'Not signed in',
  signingIn: 'Signing in…', cancelling: 'Cancelling…', saving: 'Finishing sign-in…',
  signIn: 'Sign in', signInAgain: 'Sign in again', signOut: 'Sign out', cancel: 'Cancel',
  openPage: 'Open authorization page', code: 'Verification code', copy: 'Copy', copied: 'Copied',
  copyFailed: 'Could not copy. Select the code and copy it manually.', submit: 'Continue',
  readOnly: 'This credential is read-only.', waiting: 'Waiting for authorization…',
}
export const zh: Record<keyof typeof en, string> = {
  loading: '正在检查登录状态…', signedIn: '已登录', signedOut: '未登录',
  signingIn: '登录中…', cancelling: '正在取消…', saving: '正在完成登录…',
  signIn: '登录', signInAgain: '重新登录', signOut: '退出登录', cancel: '取消',
  openPage: '打开授权页面', code: '验证码', copy: '复制', copied: '已复制',
  copyFailed: '复制失败，请选中验证码手动复制。', submit: '继续',
  readOnly: '当前凭据为只读。', waiting: '等待授权完成…',
}
export type Translate = (key: keyof typeof en) => string
