## ADDED Requirements

### Requirement: 登录表单校验
系统 SHALL 在登录页面提供账号和密码输入框，并在提交前进行非空校验。

#### Scenario: 空账号提交
- **WHEN** 用户未填写账号点击登录
- **THEN** 系统在账号字段下方显示"请输入账号"错误提示，不发起认证

#### Scenario: 空密码提交
- **WHEN** 用户填写了账号但未填写密码点击登录
- **THEN** 系统在密码字段下方显示"请输入密码"错误提示，不发起认证

### Requirement: 凭据验证
系统 SHALL 将用户输入的账号密码与写死的凭据常量进行比对，匹配则认证通过，否则认证失败。

#### Scenario: 正确凭据登录
- **WHEN** 用户输入正确的账号和密码并点击登录
- **THEN** 系统将认证状态写入 localStorage（有效期 300 天），并跳转至主体页面

#### Scenario: 错误凭据登录
- **WHEN** 用户输入错误的账号或密码并点击登录
- **THEN** 系统显示"账号或密码错误"提示，不写入 localStorage，停留在登录页

### Requirement: 会话持久化
系统 SHALL 在 localStorage 中以 `kbk_auth` 为键存储会话信息，包含登录状态和过期时间戳，有效期为 300 天。

#### Scenario: 会话未过期时访问
- **WHEN** 用户在 localStorage 存有未过期的 `kbk_auth` 记录并直接访问系统
- **THEN** 系统跳过登录页，直接进入主体页面

#### Scenario: 会话已过期时访问
- **WHEN** 用户的 `kbk_auth` 记录已超过 300 天有效期
- **THEN** 系统清除该记录并重定向至登录页

### Requirement: 路由守卫
系统 SHALL 保护所有主体页面路由，未认证用户访问受保护路由时 MUST 被重定向至登录页。

#### Scenario: 未登录访问受保护路由
- **WHEN** 未认证用户直接访问 `/admin` 或其子路由
- **THEN** 系统重定向至 `/login`

#### Scenario: 已登录用户访问登录页
- **WHEN** 已认证用户访问 `/login`
- **THEN** 系统重定向至 `/admin`

### Requirement: 退出登录
系统 SHALL 提供退出登录功能，退出后清除 localStorage 会话记录并跳转至登录页。

#### Scenario: 用户点击退出
- **WHEN** 用户在主体页面点击退出登录
- **THEN** 系统删除 `kbk_auth` localStorage 记录并重定向至 `/login`
