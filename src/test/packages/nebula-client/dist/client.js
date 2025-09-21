/**
 * Nebula Graph HTTP Gateway 客户端类
 */
import dotenv from 'dotenv';
// 加载环境变量
dotenv.config();
/**
 * Nebula Graph HTTP Gateway 客户端类
 */
export class NebulaClient {
    constructor(options = {}) {
        this.sessionId = null;
        this.gatewayHost = options.gatewayHost || process.env.GATEWAY_HOST || 'http://192.168.132.44:8080';
        this.nebulaHost = options.nebulaHost || process.env.NEBULA_HOST || '192.168.132.44';
        this.nebulaPort = options.nebulaPort || parseInt(process.env.NEBULA_PORT || '9669');
        this.username = options.username || process.env.NEBULA_USER || 'root';
        this.password = options.password || process.env.NEBULA_PASSWORD || 'nebula';
        this.space = options.space || process.env.NEBULA_SPACE || 'code_graph';
    }
    /**
     * 连接到 Nebula Graph
     */
    async connect() {
        if (this.sessionId) {
            console.log('Already connected to Nebula Graph');
            return;
        }
        const connectUrl = `${this.gatewayHost}/api/db/connect`;
        const connectData = {
            username: this.username,
            password: this.password,
            address: this.nebulaHost,
            port: this.nebulaPort
        };
        console.log(`Connecting to: ${connectUrl}`);
        console.log(`Connection data:`, connectData);
        try {
            const response = await fetch(connectUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(connectData),
            });
            console.log(`Response status: ${response.status}`);
            if (!response.ok) {
                throw new Error(`Connect failed! status: ${response.status}`);
            }
            const result = await response.json();
            console.log('Response body:', result);
            // 检查响应码
            if (result.code !== 0) {
                throw new Error(`Connect failed! code: ${result.code}, message: ${result.message}`);
            }
            // 从 Set-Cookie 头中提取 nsid
            const cookies = response.headers.get('Set-Cookie');
            if (cookies) {
                console.log('Set-Cookie header:', cookies);
                const nsidMatch = cookies.match(/nsid=([^;]+)/);
                if (nsidMatch) {
                    this.sessionId = nsidMatch[1];
                    console.log(`Connected to Nebula Graph successfully with session ID: ${this.sessionId}`);
                    return;
                }
            }
            // 如果没有从 cookie 中找到，尝试从响应体中获取
            if (result.data) {
                this.sessionId = result.data;
                console.log(`Connected to Nebula Graph successfully with session ID from response body: ${this.sessionId}`);
            }
            else {
                throw new Error('No session ID found in response');
            }
        }
        catch (error) {
            console.error('Failed to connect to Nebula Graph:', error);
            throw error;
        }
    }
    /**
     * 执行NGQL查询
     * @param query NGQL查询语句
     * @param retryCount 重试计数，防止无限递归
     * @returns 查询结果
     */
    async executeNgql(query, retryCount = 0) {
        const MAX_RETRIES = 3;
        // 确保已连接
        if (!this.sessionId) {
            await this.connect();
        }
        const execUrl = `${this.gatewayHost}/api/db/exec`;
        const execData = {
            gql: query
        };
        try {
            const response = await fetch(execUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': `nsid=${this.sessionId}`,
                },
                body: JSON.stringify(execData),
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            // 检查响应代码
            if (result.code !== 0) {
                // 如果是会话问题且未超过最大重试次数，尝试重新连接
                if (result.code === -1 && result.message && result.message.includes('session') && retryCount < MAX_RETRIES) {
                    console.log(`Session expired (attempt ${retryCount + 1}/${MAX_RETRIES}), reconnecting...`);
                    this.sessionId = null;
                    await this.connect();
                    // 重试查询
                    return this.executeNgql(query, retryCount + 1);
                }
                throw new Error(`Gateway error! code: ${result.code}, message: ${result.message}`);
            }
            // 检查查询结果中是否有错误
            if (result.data && result.data.errors && result.data.errors.length > 0) {
                console.warn(`Query warning: ${result.data.errors[0].message}`, { query });
            }
            return {
                error: null,
                data: result.data || [],
                timeCost: 0
            };
        }
        catch (error) {
            console.error(`Query error for: ${query}`, error);
            throw error;
        }
    }
    /**
     * 断开连接并释放资源
     */
    async disconnect() {
        if (!this.sessionId) {
            console.log('No active connection to release');
            return;
        }
        const disconnectUrl = `${this.gatewayHost}/api/db/disconnect`;
        try {
            const response = await fetch(disconnectUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': `nsid=${this.sessionId}`,
                },
            });
            // 断开连接不检查响应，即使失败也清除本地会话
            console.log('Nebula Graph resources released');
            this.sessionId = null;
        }
        catch (error) {
            console.error('Error releasing Nebula Graph resources:', error);
            // 即使断开连接失败，也要清除本地session
            this.sessionId = null;
        }
    }
    /**
     * 获取连接状态
     */
    isConnected() {
        return this.sessionId !== null;
    }
    /**
     * 获取当前会话ID（用于调试）
     */
    getSessionId() {
        return this.sessionId;
    }
    /**
     * 获取当前配置信息
     */
    getConfig() {
        return {
            gatewayHost: this.gatewayHost,
            nebulaHost: this.nebulaHost,
            nebulaPort: this.nebulaPort,
            username: this.username,
            space: this.space
        };
    }
}
//# sourceMappingURL=client.js.map