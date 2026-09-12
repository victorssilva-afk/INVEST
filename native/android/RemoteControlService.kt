package pt.invest.cryptoinvest

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.graphics.Path
import android.os.Bundle
import android.util.DisplayMetrics
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import okhttp3.*
import org.json.JSONObject

/**
 * Crypto.Invest — Serviço de Acessibilidade que injeta toques/swipes recebidos do técnico.
 * O cliente ativa em: Definições -> Acessibilidade -> Crypto.Invest -> Ativar.
 *
 * Liga-se ao MESMO WebSocket de sinalização, com role=android, e escuta mensagens:
 *   {"type":"gesture","action":"tap","x":0..1,"y":0..1}
 *   {"type":"gesture","action":"swipe","x":..,"y":..,"x2":..,"y2":..,"duration":ms}
 * As coordenadas são normalizadas (0..1) e convertidas para pixéis do ecrã real.
 */
class RemoteControlService : AccessibilityService() {

    private var ws: WebSocket? = null
    private val client = OkHttpClient()

    // Defina o código da sessão e o URL base (idealmente lidos de SharedPreferences/deeplink).
    private val baseWs = "wss://invest-analysis-14.preview.emergentagent.com/api/ws"
    private var sessionCode: String = SessionHolder.code ?: "demo"

    override fun onServiceConnected() {
        super.onServiceConnected()
        connect()
    }

    private fun connect() {
        val req = Request.Builder().url("$baseWs/support/$sessionCode?role=android").build()
        ws = client.newWebSocket(req, object : WebSocketListener() {
            override fun onMessage(webSocket: WebSocket, text: String) {
                try {
                    val m = JSONObject(text)
                    when (m.optString("type")) {
                        "gesture" -> handleGesture(m)
                        "text" -> handleText(m)
                    }
                } catch (_: Exception) {}
            }
            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                // reconexão simples
                try { Thread.sleep(2000) } catch (_: Exception) {}
                connect()
            }
        })
    }

    private fun screenSize(): Pair<Int, Int> {
        val wm = getSystemService(WINDOW_SERVICE) as WindowManager
        val dm = DisplayMetrics()
        @Suppress("DEPRECATION")
        wm.defaultDisplay.getRealMetrics(dm)
        return Pair(dm.widthPixels, dm.heightPixels)
    }

    private fun handleGesture(m: JSONObject) {
        val (w, h) = screenSize()
        val path = Path()
        val action = m.optString("action")
        val x = (m.optDouble("x") * w).toFloat()
        val y = (m.optDouble("y") * h).toFloat()
        if (action == "swipe") {
            val x2 = (m.optDouble("x2") * w).toFloat()
            val y2 = (m.optDouble("y2") * h).toFloat()
            val dur = m.optLong("duration", 300L).coerceIn(60L, 2000L)
            path.moveTo(x, y); path.lineTo(x2, y2)
            dispatch(path, dur)
        } else { // tap
            path.moveTo(x, y); path.lineTo(x + 1f, y + 1f)
            dispatch(path, 60L)
        }
    }

    private fun handleText(m: JSONObject) {
        // Escreve no campo focado do cliente (teclado remoto)
        val node = findFocus(AccessibilityNodeInfo.FOCUS_INPUT) ?: return
        val args = Bundle()
        args.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, m.optString("value"))
        node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)
    }

    private fun dispatch(path: Path, duration: Long) {
        val stroke = GestureDescription.StrokeDescription(path, 0, duration)
        val gesture = GestureDescription.Builder().addStroke(stroke).build()
        dispatchGesture(gesture, null, null)
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {}
    override fun onInterrupt() {}
    override fun onDestroy() { super.onDestroy(); ws?.close(1000, null) }
}

/** Guarda o código da sessão (definido pela WebView ao abrir /suporte/{code}). */
object SessionHolder { var code: String? = null }
