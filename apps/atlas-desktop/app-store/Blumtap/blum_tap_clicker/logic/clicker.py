from threading import Thread
from numpy import where, all, transpose, array
from pygetwindow import getWindowsWithTitle
from mss import mss
from pyautogui import click, locateOnScreen
from keyboard import is_pressed
def get_window():
    try:
        window = getWindowsWithTitle('TelegramDesktop')[-1]
        return {"left": window.left, "top": window.top, "width": window.width, "height": window.height}
    except IndexError:
        print("Run Blum webapp")
        exit(1)
def find_color(color, image):
    mapping = (color[2], color[1], color[0], 255)
    indexes = where(all(image == mapping, axis=-1))
    return transpose(indexes)
def run(color, mon, button=None):
    with mss() as sct:
        while True:
            img_arr = array(sct.grab(mon))
            result = find_color(color, img_arr)
            if len(result):
                click(result[0][1] + mon.get('left'), result[0][0] + mon.get('top'))
            elif button is not None:
                click(locateOnScreen(button, confidence=0.7, grayscale=True))
            if is_pressed("q"):
                break         
if __name__ == '__main__':
    monitor = get_window()
    threads = (Thread(target=run, args=((205, 220, 0), monitor, 'button.png')), Thread(target=run, args=((230, 255, 145), monitor)))
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    print('Script has been stop')