import { Controller, Get } from "@nestjs/common";
import * as os from "node:os";

/**
 * 服务器信息端点
 *
 * 给前端提供本机局域网 IP，用于"复制协作链接"时把 localhost 换成 IP，
 * 方便发给同局域网的其他设备（手机/同事电脑）打开。
 */
@Controller("api/info")
export class InfoController {
  /**
   * 返回本机局域网 IPv4（非回环、非虚拟接口）。
   * 取第一个匹配的；没有则返回 null。
   */
  @Get("lan-ip")
  getLanIp(): { lanIp: string | null } {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] ?? []) {
        // IPv4 + 非内网回环地址
        if (iface.family === "IPv4" && !iface.internal) {
          return { lanIp: iface.address };
        }
      }
    }
    return { lanIp: null };
  }
}
