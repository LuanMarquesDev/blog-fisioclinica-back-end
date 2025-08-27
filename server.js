require("dotenv").config();
const express = require("express");
const { Pool } = require("pg");
const bodyParser = require("body-parser");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const jwt = require("jsonwebtoken");

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN }));
app.use(bodyParser.json());
app.use(morgan("combined"));

// Conexão com PostgreSQL
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

pool
  .connect()
  .then(() => console.log("✅ Conectado ao PostgreSQL"))
  .catch((err) => {
    console.error("❌ Erro ao conectar ao PostgreSQL:", err);
    process.exit(1);
  });

// Middleware de autenticação JWT
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "Não autorizado" });

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Token inválido" });
  }
}

// Login retorna token
app.post("/login", (req, res) => {
  const { usuario, senha } = req.body;

  if (usuario === process.env.ADMIN_USER && senha === process.env.ADMIN_PASS) {
    const token = jwt.sign({ usuario }, process.env.JWT_SECRET, {
      expiresIn: "2h",
    });
    return res.json({ token });
  }

  res.status(401).json({ message: "Usuário ou senha incorretos" });
});

// Rotas públicas
app.get("/posts", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM posts ORDER BY id DESC");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json(err);
  }
});

app.get("/posts/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query("SELECT * FROM posts WHERE id=$1", [id]);
    if (result.rows.length === 0)
      return res.status(404).json({ message: "Post não encontrado" });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json(err);
  }
});

// Rotas protegidas (JWT)
app.post("/posts", authMiddleware, async (req, res) => {
  const { titulo, resumo, conteudo, categoria, imagem } = req.body;
  const data = new Date().toISOString().split("T")[0];

  try {
    const result = await pool.query(
      "INSERT INTO posts (titulo, resumo, conteudo, categoria, imagem, data) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
      [titulo, resumo, conteudo, categoria, imagem, data]
    );
    res.json({ id: result.rows[0].id });
  } catch (err) {
    res.status(500).json(err);
  }
});

app.put("/posts/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { titulo, resumo, conteudo, categoria, imagem } = req.body;

  try {
    const result = await pool.query(
      "UPDATE posts SET titulo=$1, resumo=$2, conteudo=$3, categoria=$4, imagem=$5 WHERE id=$6",
      [titulo, resumo, conteudo, categoria, imagem, id]
    );
    res.json({ updated: result.rowCount });
  } catch (err) {
    res.status(500).json(err);
  }
});

app.delete("/posts/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query("DELETE FROM posts WHERE id=$1", [id]);
    res.json({ deleted: result.rowCount });
  } catch (err) {
    res.status(500).json(err);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`)
);
