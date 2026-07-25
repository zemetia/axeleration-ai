export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const os = await import('node:os');

    const R = '\x1b[0m';
    const B = '\x1b[1m';
    const D = '\x1b[2m';
    const CYAN = '\x1b[96m';
    const YELLOW = '\x1b[33m';
    const GREEN = '\x1b[32m';
    const WHITE = '\x1b[97m';

    const getLocalIP = () => {
      for (const nets of Object.values(os.networkInterfaces())) {
        for (const net of nets ?? []) {
          if (net.family === 'IPv4' && !net.internal) return net.address;
        }
      }
      return '127.0.0.1';
    };

    const port = process.env.PORT ?? '3000';
    const ip = getLocalIP();
    const sep = `${D}${'─'.repeat(52)}${R}`;

    const banner = `
${CYAN}${B}███████╗███████╗███╗   ███╗███████╗████████╗██╗ █████╗
╚══███╔╝██╔════╝████╗ ████║██╔════╝╚══██╔══╝██║██╔══██╗
  ███╔╝ █████╗  ██╔████╔██║█████╗     ██║   ██║███████║
 ███╔╝  ██╔══╝  ██║╚██╔╝██║██╔══╝     ██║   ██║██╔══██║
███████╗███████╗██║ ╚═╝ ██║███████╗   ██║   ██║██║  ██║
╚══════╝╚══════╝╚═╝     ╚═╝╚══════╝   ╚═╝   ╚═╝╚═╝  ╚═╝

██████╗ ██████╗  ██████╗      ██╗███████╗ ██████╗████████╗
██╔══██╗██╔══██╗██╔═══██╗     ██║██╔════╝██╔════╝╚══██╔══╝
██████╔╝██████╔╝██║   ██║     ██║█████╗  ██║        ██║
██╔═══╝ ██╔══██╗██║   ██║██   ██║██╔══╝  ██║        ██║
██║     ██║  ██║╚██████╔╝╚█████╔╝███████╗╚██████╗   ██║
╚═╝     ╚═╝  ╚═╝ ╚═════╝  ╚════╝ ╚══════╝ ╚═════╝   ╚═╝${R}

  ${B}${WHITE}Next.js Frontend Edition${R}  ${D}·${R}  ${YELLOW}${B}Zemetia${R}
  ${D}Production-grade AI-first boilerplate${R}

  ${D}github.com/zemetia${R}

  ${sep}
  ${D}Local  ${R}   ${GREEN}→${R}  ${B}http://localhost:${port}${R}
  ${D}Network${R}   ${GREEN}→${R}  ${B}http://${ip}:${port}${R}
  ${sep}
`;

    process.stdout.write(banner + '\n');

    await import('../sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config');
  }
}

export async function onRequestError(
  error: unknown,
  request: { path: string; method: string; headers: Record<string, string> },
  context: { routerKind: string; routePath: string; routeType: string },
): Promise<void> {
  const { captureRequestError } = await import('@sentry/nextjs');
  captureRequestError(error, request, context);
}
