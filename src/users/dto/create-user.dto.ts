/**
 * 创建用户 DTO
 * 用于验证创建用户时的请求参数
 */
export class CreateUserDto {
  email: string; // 用户邮箱
  password: string; // 用户密码
  name?: string; // 用户昵称 (可选)
}
