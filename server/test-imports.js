// Quick test to verify module imports
console.log('Testing module imports...');

async function testImports() {
    try {
        console.log('1. Testing jobRunner...');
        const jobRunner = await import('./jobs/jobRunner.js');
        console.log('   OK - jobRunner exports:', Object.keys(jobRunner).join(', '));

        console.log('2. Testing emailService...');
        const emailService = await import('./jobs/emailService.js');
        console.log('   OK - emailService exports:', Object.keys(emailService).join(', '));

        console.log('3. Testing notificationService...');
        const notificationService = await import('./jobs/notificationService.js');
        console.log('   OK - notificationService exports:', Object.keys(notificationService).join(', '));

        console.log('4. Testing balanceService...');
        const balanceService = await import('./jobs/balanceService.js');
        console.log('   OK - balanceService exports:', Object.keys(balanceService).join(', '));

        console.log('5. Testing scheduler...');
        const scheduler = await import('./jobs/scheduler.js');
        console.log('   OK - scheduler exports:', Object.keys(scheduler).join(', '));

        console.log('6. Testing socket...');
        const socket = await import('./config/socket.js');
        console.log('   OK - socket exports:', Object.keys(socket).join(', '));

        console.log('7. Testing security middleware...');
        const security = await import('./middleware/security.js');
        console.log('   OK - security exports:', Object.keys(security).join(', '));

        console.log('\n✅ All module imports successful!');
        process.exit(0);
    } catch (err) {
        console.error('\n❌ Import failed:', err.message);
        console.error(err.stack);
        process.exit(1);
    }
}

testImports();
