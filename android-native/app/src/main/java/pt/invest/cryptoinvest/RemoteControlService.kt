package pt.invest.cryptoinvest

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.content.Context
import android.graphics.Path
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.DisplayMetrics
import android.util.Log
import android.view.ViewConfiguration
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

/**
 * Recebe comandos remotos (toque, deslize, texto) vindos do tecnico via ScreenShareService
 * e executa-os no ecra usando a API de Acessibilidade.
 */
class RemoteControlService : AccessibilityService() {

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
        Log.d(TAG, "Acessibilidade LIGADA — controlo remoto pronto")
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {}
    override fun onInterrupt() {}
    override fun onDestroy() { if (instance === this) instance = null; super.onDestroy() }

    private val main = Handler(Looper.getMainLooper())

    private fun screenSize(): Pair<Int, Int> {
        val wm = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        val m = DisplayMetrics()
        @Suppress("DEPRECATION")
        wm.defaultDisplay.getRealMetrics(m)
        return Pair(m.widthPixels, m.heightPixels)
    }

    // Despacha o gesto SEMPRE na main thread (alguns aparelhos OEM ignam gestos fora dela) e com
    // GestureResultCallback para registar no Logcat se foi executado ou cancelado (diagnostico real).
    private fun dispatch(gesture: GestureDescription, label: String) {
        main.post {
            try {
                val ok = dispatchGesture(gesture, object : GestureResultCallback() {
                    override fun onCompleted(g: GestureDescription?) { Log.d(TAG, "$label executado") }
                    override fun onCancelled(g: GestureDescription?) { Log.w(TAG, "$label CANCELADO (toque do utilizador ou outro servico interrompeu)") }
                }, null)
                if (!ok) Log.w(TAG, "$label: dispatchGesture devolveu FALSE (verifique canPerformGestures/permissao)")
            } catch (e: Exception) { Log.w(TAG, "$label falhou", e) }
        }
    }

    fun doTap(nx: Double, ny: Double) {
        val (w, h) = screenSize()
        val x = (nx * w).toFloat().coerceIn(0f, (w - 1).toFloat())
        val y = (ny * h).toFloat().coerceIn(0f, (h - 1).toFloat())
        // IMPORTANTE: um Path so com moveTo tem comprimento ZERO e e ignorado em muitos aparelhos
        // fisicos (o toque "nao faz nada"). Adicionamos um micro-deslocamento para dar comprimento.
        val path = Path().apply { moveTo(x, y); lineTo(x + 1f, y + 1f) }
        // Duracao de toque recomendada pela plataforma (duracao demasiado curta falha de forma intermitente).
        val tapTime = ViewConfiguration.getTapTimeout().toLong().coerceIn(60L, 200L)
        val gesture = GestureDescription.Builder()
            .addStroke(GestureDescription.StrokeDescription(path, 0, tapTime))
            .build()
        dispatch(gesture, "toque")
    }

    fun doSwipe(nx1: Double, ny1: Double, nx2: Double, ny2: Double, durationMs: Long) {
        val (w, h) = screenSize()
        val x1 = (nx1 * w).toFloat(); val y1 = (ny1 * h).toFloat()
        var x2 = (nx2 * w).toFloat(); var y2 = (ny2 * h).toFloat()
        // Garante comprimento != 0 mesmo que inicio ~ fim.
        if (Math.hypot((x2 - x1).toDouble(), (y2 - y1).toDouble()) < 2.0) { x2 = x1 + 2f; y2 = y1 + 2f }
        val path = Path().apply { moveTo(x1, y1); lineTo(x2, y2) }
        val dur = durationMs.coerceIn(80L, 2000L)
        val gesture = GestureDescription.Builder()
            .addStroke(GestureDescription.StrokeDescription(path, 0, dur))
            .build()
        dispatch(gesture, "deslize")
    }

    private fun focusedEditable(): AccessibilityNodeInfo? {
        val n = findFocus(AccessibilityNodeInfo.FOCUS_INPUT) ?: rootInActiveWindow?.let { findFocusedEditable(it) }
        return if (n != null && n.isEditable) n else null
    }

    private fun setNodeText(node: AccessibilityNodeInfo, newText: String) {
        val args = Bundle().apply {
            putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, newText)
        }
        node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)
        val sel = Bundle().apply {
            putInt(AccessibilityNodeInfo.ACTION_ARGUMENT_SELECTION_START_INT, newText.length)
            putInt(AccessibilityNodeInfo.ACTION_ARGUMENT_SELECTION_END_INT, newText.length)
        }
        node.performAction(AccessibilityNodeInfo.ACTION_SET_SELECTION, sel)
    }

    fun typeText(text: String) {
        if (text.isEmpty()) return
        main.post {
            val node = focusedEditable()
            if (node == null) { Log.w(TAG, "texto: nenhum campo focado"); return@post }
            setNodeText(node, (node.text?.toString() ?: "") + text)
        }
    }

    fun keyAction(key: String) {
        main.post {
            when (key) {
                "Backspace" -> {
                    val node = focusedEditable() ?: return@post
                    val cur = node.text?.toString() ?: ""
                    if (cur.isNotEmpty()) setNodeText(node, cur.substring(0, cur.length - 1))
                }
                "Enter" -> {
                    val node = findFocus(AccessibilityNodeInfo.FOCUS_INPUT)
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && node != null) {
                        try { node.performAction(AccessibilityNodeInfo.AccessibilityAction.ACTION_IME_ENTER.id) } catch (e: Exception) {}
                    }
                }
            }
        }
    }

    private fun findFocusedEditable(node: AccessibilityNodeInfo?): AccessibilityNodeInfo? {
        if (node == null) return null
        if (node.isEditable && node.isFocused) return node
        for (i in 0 until node.childCount) {
            val r = findFocusedEditable(node.getChild(i))
            if (r != null) return r
        }
        return null
    }

    fun globalAction(name: String) {
        val a = when (name) {
            "back" -> GLOBAL_ACTION_BACK
            "home" -> GLOBAL_ACTION_HOME
            "recents" -> GLOBAL_ACTION_RECENTS
            "notifications" -> GLOBAL_ACTION_NOTIFICATIONS
            else -> return
        }
        main.post {
            try { val ok = performGlobalAction(a); Log.d(TAG, "nav $name -> $ok") }
            catch (e: Exception) { Log.w(TAG, "nav $name falhou", e) }
        }
    }

    companion object {
        const val TAG = "CIScreenShare"
        @Volatile
        var instance: RemoteControlService? = null
    }
}
