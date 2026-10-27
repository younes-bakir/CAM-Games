let timer = 0;
let integrity = 100;
let score = 0;

const notifications = [
    {
        title: "Kernel Patch 1.4.0",
        desc: "Source: Trusted Core Dev | Size: 569MB",
        type: "real"
    },
    {
        title: "Critical Warning: RAM Full!",
        desc: "Click here to download more memory",
        type: "fake"
    },
    {
        title: "System Hotfix #97",
        desc: "Source: Unknown Server | Protocol: Insecure",
        type: "fake"
    },
    {
        title: "High CPU Usage Detected",
        desc: "Run PCCleaner to clear process threads",
        type: "real"
    },
    {
        title: "OS Software Update v11.4",
        desc: "Source: Central Distribution Server | Signed by Root Auth",
        type: "real"
    },
    {
        title: "Display Driver Update",
        desc: "Source: Hardware OEM Repository | Verified WHQL Signature",
        type: "real"
    },
    {
        title: "Backup Node Echo-4 Synced",
        desc: "Target: Remote Server [192.168.x.x] // Protocol: outbound-SSH",
        type: "fake"
    },
    {
        title: "Bandwidth Optimization Complete",
        desc: "Proxy routing active for all DNS requests through public-node-99",
        type: "fake"
    },
    {
        title: "BIOS Signature Match Detected",
        desc: "SHA-256 Hash Verified against Motherboard manufacturer cert",
        type: "real"
    },
    {
        title: "Security Patch from Microsoft OS",
        desc: "Source: trusted-update-node-01 // Verified Certificate",
        type: "fake"
    }
];
