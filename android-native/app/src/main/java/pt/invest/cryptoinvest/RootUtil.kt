package pt.invest.cryptoinvest

import android.content.Context
import android.util.Log
import java.io.File
import java.net.URL

// Utilitario de root para o "desbloqueio automatico" do FLAG_SECURE em EMULADORES com root.
// NOTA: o FLAG_SECURE (Chrome anonimo, apps bancarias, jogos, DRM) e imposto pelo sistema
// (SurfaceFlinger/WindowManager) e SO pode ser desativado ao nivel do framework. Isto e feito
// por um modulo Magisk que corrige o services.jar. Aqui deteta-se root/Magisk e, se possivel,
// instala-se esse modulo automaticamente. Requer reinicio do emulador para aplicar.
object RootUtil {
    private const val TAG = "CIRoot"

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

    fun isSecureDisablerInstalled(): Boolean {
        val (ok, out) = runSu("ls /data/adb/modules/ 2>/dev/null")
        if (!ok) return false
        val low = out.lowercase()
        return low.contains("flagsecure") || (low.contains("flag") && low.contains("secure"))
    }

    // Descarrega e instala o modulo Magisk que desativa o FLAG_SECURE. Devolve (sucesso, mensagem).
    fun installDisablerModule(ctx: Context, url: String): Pair<Boolean, String> {
        if (!isRooted()) return Pair(false, "Sem root neste aparelho — siga o guia manual (LSPosed/Magisk).")
        if (!hasMagisk()) return Pair(false, "Magisk nao detetado — instale o Magisk primeiro (ver guia).")
        if (isSecureDisablerInstalled()) return Pair(true, "Modulo ja instalado. Reinicie o emulador se ainda ficar preto.")
        return try {
            val zip = File(ctx.cacheDir, "flagsecure_disabler.zip")
            URL(url).openStream().use { input -> zip.outputStream().use { input.copyTo(it) } }
            if (zip.length() < 1000) return Pair(false, "Falha ao descarregar o modulo (verifique a internet).")
            val (ok, msg) = runSu("magisk --install-module ${zip.absolutePath}")
            if (ok) Pair(true, "Modulo instalado. REINICIE o emulador para aplicar.")
            else Pair(false, "Falha ao instalar via Magisk: $msg")
        } catch (e: Exception) {
            Log.w(TAG, "install module fail", e)
            Pair(false, "Erro no desbloqueio automatico: ${e.message}. Use o guia manual.")
        }
    }
}
