# Como Adicionar a Logo da Empresa no Relatório PDF

## Passos para adicionar a logo:

### 1. Prepare a imagem da logo
- Formato recomendado: PNG com fundo transparente
- Tamanho recomendado: 200x80 pixels (ou proporcional)
- Salve a imagem na pasta do projeto como `logo-msl.png`

### 2. Converta a imagem para Base64
Você tem 3 opções:

**Opção A - Usar um site online:**
1. Acesse: https://www.base64-image.de/
2. Faça upload da sua logo
3. Copie o código Base64 gerado

**Opção B - Usar JavaScript no console do navegador:**
```javascript
// Cole este código no console do navegador após carregar uma página com a imagem
fetch('logo-msl.png')
  .then(response => response.blob())
  .then(blob => {
    const reader = new FileReader();
    reader.onloadend = () => console.log(reader.result);
    reader.readAsDataURL(blob);
  });
```

**Opção C - Usar Node.js:**
```javascript
const fs = require('fs');
const imageBuffer = fs.readFileSync('logo-msl.png');
const base64Image = imageBuffer.toString('base64');
console.log('data:image/png;base64,' + base64Image);
```

### 3. Adicione a logo no código

No arquivo **app.js**, localize a linha **753** (comentário sobre a logo):
```javascript
// Logo MSL Estratégia (você pode adicionar a logo depois)
// Por enquanto, vou adicionar o texto
```

Substitua as linhas 753-758 por:
```javascript
// Logo MSL Estratégia
const logoBase64 = 'SEU_CODIGO_BASE64_AQUI'; // Cole o código Base64 da logo aqui
try {
    doc.addImage(logoBase64, 'PNG', pageWidth - 50, 5, 40, 16); // Ajuste posição e tamanho conforme necessário
} catch (error) {
    // Se houver erro ao carregar a logo, usa o texto
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('MSL ESTRATÉGIA', pageWidth - 65, 12);
}
```

### 4. Ajuste a posição e tamanho
Os parâmetros da função `addImage` são:
- `pageWidth - 50`: Posição horizontal (50mm da direita)
- `5`: Posição vertical (5mm do topo)
- `40`: Largura da imagem em mm
- `16`: Altura da imagem em mm

Ajuste esses valores conforme necessário para melhor visualização.

### 5. Teste o relatório
1. Faça login no sistema
2. Vá para "Gerar Relatório"
3. Selecione os filtros e clique em "Gerar Relatório"
4. Clique em "Exportar PDF"
5. Verifique se a logo aparece corretamente no PDF gerado

## Exemplo completo de código com logo:

```javascript
// ===== CABEÇALHO COM CORES E DESIGN =====
// Faixa diagonal preta (superior esquerda)
doc.setFillColor(0, 0, 0);
doc.triangle(0, 0, 60, 0, 0, 30, 'F');

// Faixa diagonal turquesa/verde-água
doc.setFillColor(64, 190, 175);
doc.triangle(60, 0, pageWidth, 0, pageWidth, 45, 'F');
doc.triangle(60, 0, 0, 30, pageWidth, 45, 'F');

// Logo MSL Estratégia
const logoBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANS...'; // Seu código Base64 completo aqui
try {
    doc.addImage(logoBase64, 'PNG', pageWidth - 50, 5, 40, 16);
} catch (error) {
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('MSL ESTRATÉGIA', pageWidth - 65, 12);
}
```

## Observações:
- O código Base64 pode ser muito longo (vários milhares de caracteres) - isso é normal
- Certifique-se de incluir o prefixo `data:image/png;base64,` antes do código
- Se a logo não aparecer, verifique se o código Base64 está completo e correto
- Ajuste as cores do cabeçalho conforme necessário para combinar com a identidade visual

## Contato
Se precisar de ajuda, entre em contato com o desenvolvedor do sistema.
