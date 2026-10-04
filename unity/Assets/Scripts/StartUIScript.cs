using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.SceneManagement;

public class StartUIScript : MonoBehaviour
{
    public void StartGame() => SceneManager.LoadScene("Gameplay");
    public void LoadHowToPlay() => SceneManager.LoadScene("HowToPlay");
    public void ExitGame() => Application.Quit();
    public void ExitToStart() => SceneManager.LoadScene("Start");
}
