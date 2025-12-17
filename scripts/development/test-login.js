async function testLogin() {
  try {
    const response = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'josiassm701@gmail.com',
        password: '32588589',
        secretPhrase: 'kaka' // Adicionando a frase secreta
      })
    });

    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Resposta:', JSON.stringify(data, null, 2));

    if (data.success && data.data?.token) {
      console.log('\nToken obtido:', data.data.token);
      
      // Testar acesso ao dashboard admin
      const adminResponse = await fetch('http://localhost:3001/api/admin/dashboard', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${data.data.token}`,
          'Content-Type': 'application/json',
        }
      });

      const adminData = await adminResponse.json();
      console.log('\nAcesso admin - Status:', adminResponse.status);
      console.log('Acesso admin - Resposta:', JSON.stringify(adminData, null, 2));
    }
  } catch (error) {
    console.error('Erro:', error);
  }
}

testLogin();