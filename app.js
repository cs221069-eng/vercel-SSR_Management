require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const connectToDb = require("./server/src/db/db");
const adminRouter = require("./server/src/router/admin_routes");
const authRouter = require("./server/src/router/auth_routes");
const userRouter = require("./server/src/router/user_routes");
const pageRouter = require("./routes/pages");

const app = express();
app.set("trust proxy", 1);

let dbReady = false;
async function ensureDb() {
  if (!dbReady) {
    await connectToDb();
    dbReady = true;
  }
}

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(async (req, res, next) => {
  try {
    await ensureDb();
    next();
  } catch (error) {
    next(error);
  }
});
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use("/public", express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.use("/api/admin", adminRouter);
app.use("/api/auth", authRouter);
app.use("/api/user", userRouter);
app.use(pageRouter);

app.use((req, res) => {
  res.status(404).render("error", {
    title: "Page Not Found",
    message: "The requested page does not exist."
  });
});

module.exports = app;

if (require.main === module) {
  const PORT = process.env.SSR_PORT || process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`SSR server is running on ${PORT}`);
  });
}
