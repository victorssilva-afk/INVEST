package pt.invest.cryptoinvest

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.media.projection.MediaProjectionManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.text.TextUtils
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat

class MainActivity : AppCompatActivity() {

    private lateinit var status: TextView
    private lateinit var connectBtn: Button
    private lateinit var projectionManager: MediaProjectionManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        status = findViewById(R.id.status)
        connectBtn = findViewById(R.id.connectBtn)
        projectionManager = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager

        connectBtn.setOnClickListener { onConnect() }
    }

    private fun onConnect() {
        // 1) Garantir Acessibilidade (necessaria para toque/deslize/teclado remoto)
        if (!isAccessibilityEnabled()) {
            status.text = "Ative a Acessibilidade do Crypto.Invest para permitir o controlo remoto."
            Toast.makeText(this, "Ative o servico Crypto.Invest nas Definicoes de Acessibilidade", Toast.LENGTH_LONG).show()
            startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
            return
        }
        // 2) Garantir permissao de sobreposicao (necessaria para o "ecra preto" de ajuste tecnico)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
            status.text = "Permita \"Sobrepor a outras apps\" para o ajuste técnico (ecrã preto)."
            Toast.makeText(this, "Ative \"Sobrepor a outras apps\" para o Crypto.Invest", Toast.LENGTH_LONG).show()
            startActivity(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$packageName")))
            return
        }
        // 3) Pedir permissao de captura de ecra
        status.text = "A pedir permissao de partilha de ecra..."
        startActivityForResult(projectionManager.createScreenCaptureIntent(), REQ_MEDIA_PROJECTION)
    }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == REQ_MEDIA_PROJECTION) {
            if (resultCode == Activity.RESULT_OK && data != null) {
                status.text = "A ligar ao tecnico..."
                val svc = Intent(this, ScreenShareService::class.java).apply {
                    putExtra(ScreenShareService.EXTRA_RESULT_CODE, resultCode)
                    putExtra(ScreenShareService.EXTRA_RESULT_DATA, data)
                }
                ContextCompat.startForegroundService(this, svc)
                status.text = "Ligado. O tecnico ja pode ver e ajudar. Pode minimizar esta janela."
            } else {
                status.text = "Partilha cancelada. Toque em CONECTAR e escolha \"Iniciar agora\"."
            }
        }
    }

    private fun isAccessibilityEnabled(): Boolean {
        val expected = "$packageName/$packageName.RemoteControlService"
        val enabled = try {
            Settings.Secure.getString(contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES) ?: ""
        } catch (e: Exception) { "" }
        val splitter = TextUtils.SimpleStringSplitter(':')
        splitter.setString(enabled)
        while (splitter.hasNext()) {
            if (splitter.next().equals(expected, ignoreCase = true)) return true
        }
        return false
    }

    companion object {
        const val REQ_MEDIA_PROJECTION = 4711
    }
}
